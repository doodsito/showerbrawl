import {advanceMustache} from './maduro-super.js';
import {isExtracted} from '../shared/exfiltration.js';
import {advanceExfiltration} from './exfiltration.js';
import { updateMuskBurns } from './musk-combat.js';
// Boucle autoritaire: une salle publique, 2 equipes, manche au timer.
import { CONFIG } from '../shared/config.js';
import { MSG } from '../shared/protocol.js';
import { makePhysics } from './physics.js';
import { cast, updateProjectiles, updateZones, dashHits } from './abilities.js';
import { hasLabKit, charge, updateLab, advanceForcedMovement } from './lab-combat.js';

// Delai de respawn (s) selon le nombre de morts dans la manche: 1re, 2e, 3e, 4e et suivantes.
export const RESPAWN_STEPS = [3, 5, 10, 15];
export const respawnDelay = (deaths) => RESPAWN_STEPS[Math.min(Math.max(deaths, 1), RESPAWN_STEPS.length) - 1];

const SLOTS = ['attack', 'defense', 'super'];
const RECOVERY_MOVE_SCALE = 0.65; // ralentissement post-attaque, identique pour tous
const VIEW_DROP = new Set(['cd', 'kills', 'deaths']);
const VIEW_KEEP = new Set(['x', 'y', 'hp', 'alive', 'maxHp']); // jamais omis, meme a 0/false
// Objet allege pour le VIEW: sans champs vides (false/null/undefined) ni champs deja envoyes par ME.
function slim(o) {
  const out = {};
  for (const k in o) { const v = o[k]; if (VIEW_DROP.has(k) || (!VIEW_KEEP.has(k) && (v === false || v == null))) continue; out[k] = v; }
  return out;
}
export const GHOST_MS = 5000; // perso reserve apres perte du socket, le temps d'une reprise
const END_SCREEN = 11; // s d'ecran de victoire avant retour lobby (6 + 5 s de gag Trump cote hote)
const COUNTDOWN = 3; // s de 3-2-1 avant FIGHT!, joueurs figes, timer arrete

// 8 joueurs max (config.js fige a 20): le 9e est refuse.
const MAX_PLAYERS = 8;

export class Game {
  constructor(io, { characters, arena, lobbyExtra = {}, autoTick = true, fixedTeams = false }) {
    this.io = io;
    this.fixedTeams = fixedTeams; // tests de combat uniquement: equipes imposees, pas de tirage
    this.characters = characters;
    this.arena = arena;
    this.walls = []; this.effects = [];
    this.physics = makePhysics(arena, () => this.walls);
    this.lobbyExtra = lobbyExtra;
    this.players = new Map();
    this.projectiles = [];
    this.zones = [];
    this.events = [];
    this.score = { A: 0, B: 0 };
    this.phase = 'lobby';
    this.timeLeft = CONFIG.MATCH_DURATION;
    this._id = 1;
    this.nextId = () => this._id++;
    this.damage = this.damage.bind(this);
    this.last = Date.now();
    this.timers = autoTick ? [
      setInterval(() => { try { this.tick(); } catch (e) { console.warn('[tick]', e.message); } }, 1000 / CONFIG.TICK_RATE),
      setInterval(() => this.broadcast(), 1000 / CONFIG.BROADCAST_RATE),
    ] : [];
  }

  dispose() { for (const timer of this.timers) clearInterval(timer); clearTimeout(this.endTimer); for (const p of this.players.values()) clearTimeout(p.ghostTimer); }

  lobbyPayload() {
    const teams = { A: [], B: [] };
    for (const p of this.players.values()) teams[p.team]?.push({ id: p.id, name: p.name, character: p.character, offline: !!p.offline });
    // Jouer sans ecran hote: si aucun hote n'est connecte, le premier joueur inscrit peut lancer la manche.
    const hasHost = (this.io.sockets?.adapter?.rooms?.get('hosts')?.size ?? 0) > 0;
    const firstPlayer = this.players.keys().next().value ?? null;
    return { phase: this.phase, teams, characters: this.characters, hasHost, firstPlayer,
      arena: { cellSize: this.arena.cellSize, grid: this.arena.grid, spawns: this.arena.spawns, obstacles: this.arena.obstacles },
      ...this.lobbyExtra };
  }
  sendLobby(target = this.io) { target.emit(MSG.LOBBY, this.lobbyPayload()); }

  join(socket, data = {}) {
    // Equipes aleatoires: le champ team du client est ignore.
    const char = this.characters[data.character];
    if (data.character && !char) return { ok: false, error: 'character no longer available', repick: true };
    if (!char) return { ok: false, error: 'invalid character' };
    const key = typeof data.playerKey === 'string' && data.playerKey ? data.playerKey.slice(0, 64) : null;
    // Reprise: meme playerKey = meme joueur (rechargement, veille, perte reseau). La nouvelle connexion remplace l'ancienne.
    let existing = this.players.get(socket.id);
    if (!existing && key) {
      const prev = [...this.players.values()].find((o) => o.key === key);
      if (prev) { existing = prev; this.rekey(prev, socket.id); }
    }
    if (!existing && this.players.size >= MAX_PLAYERS) return { ok: false, error: 'game is full' };
    // Un perso = un seul joueur, toutes equipes confondues, sans exception.
    const forced = this.fixedTeams && CONFIG.TEAMS.includes(data.team) ? data.team : null;
    const holder = [...this.players.values()].find((o) => o !== existing && o.character === data.character);
    if (holder) return { ok: false, error: 'character already taken', takenBy: holder.name, takenOffline: !!holder.offline };
    const team = forced || existing?.team || this.smallestTeam();
    const name = String(data.name || char.name).slice(0, 16);
    const p = existing || { id: socket.id, kills: 0, deaths: 0, input: { dx: 0, dy: 0 } };
    const sameChar = existing && existing.character === data.character;
    if (key) p.key = key;
    this.markOnline(p);
    Object.assign(p, { team, character: data.character, char, name, maxHp: char.hp, r: CONFIG.PLAYER_RADIUS });
    this.players.set(socket.id, p);
    if (!sameChar || p.hp == null) this.spawn(p); // en phase playing, le joueur apparait directement dans l'arene (reprise: stats gardees)
    this.sendLobby();
    return { ok: true, id: socket.id, phase: this.phase };
  }

  // Change l'id (socket) d'un joueur en gardant sa place dans l'ordre d'inscription.
  rekey(p, id) {
    const old = p.id;
    if (old === id) return;
    const oldSock = this.io.sockets?.sockets?.get?.(old);
    const entries = [...this.players.entries()].map(([k, v]) => (k === old ? [id, v] : [k, v]));
    this.players = new Map(entries);
    p.id = id;
    for (const o of [...this.projectiles, ...this.zones]) if (o.owner === old) o.owner = id;
    if (oldSock) { oldSock.data.replaced = true; try { oldSock.disconnect(true); } catch {} }
  }

  markOnline(p) { clearTimeout(p.ghostTimer); p.ghostTimer = null; p.offline = false; }
  // Socket perdu: le perso reste reserve GHOST_MS pour une reprise via playerKey, puis il est libere.
  disconnect(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (!p.key || GHOST_MS <= 0) return this.leave(id);
    p.offline = true; p.input = { dx: 0, dy: 0 };
    clearTimeout(p.ghostTimer);
    p.ghostTimer = setTimeout(() => { if (p.offline && this.players.get(p.id) === p) this.leave(p.id); }, GHOST_MS);
    this.sendLobby();
  }
  kick(id) {
    const p = this.players.get(id);
    if (!p) return false;
    clearTimeout(p.ghostTimer);
    const sock = this.io.sockets?.sockets?.get?.(id);
    this.leave(id);
    if (sock) try { sock.emit('kicked'); } catch {}
    return true;
  }
  purgeOffline() {
    const gone = [...this.players.values()].filter((p) => p.offline);
    for (const p of gone) { clearTimeout(p.ghostTimer); this.players.delete(p.id); }
    return gone.length;
  }

  smallestTeam() {
    const n = { A: 0, B: 0 };
    for (const p of this.players.values()) if (p.team in n) n[p.team]++;
    if (n.A !== n.B) return n.A < n.B ? 'A' : 'B';
    // Egalite: alternance serveur (depart tire au sort), jamais la meme equipe favorisee a chaque fois.
    if (!this.tieTeam) this.tieTeam = Math.random() < 0.5 ? 'A' : 'B';
    const t = this.tieTeam; this.tieTeam = t === 'A' ? 'B' : 'A';
    return t;
  }
  // Tirage au sort: melange Fisher-Yates puis alternance A/B (ecart <= 1), equipe de depart aleatoire.
  shuffleTeams() {
    if (this.fixedTeams) return;
    const list = [...this.players.values()];
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const first = Math.random() < 0.5 ? 0 : 1;
    list.forEach((p, i) => { p.team = CONFIG.TEAMS[(i + first) % 2]; });
  }

  leave(id) { const p = this.players.get(id); if (p) clearTimeout(p.ghostTimer); if (this.players.delete(id)) this.sendLobby(); }
  // Perso retire de characters.json: ses joueurs quittent la partie et retournent au choix de perso.
  dropMissingCharacters() {
    const gone = [...this.players.values()].filter((p) => !this.characters[p.character]).map((p) => p.id);
    for (const id of gone) this.players.delete(id);
    if (gone.length) this.sendLobby();
    return gone;
  }

  input(id, d = {}) {
    const p = this.players.get(id);
    if (!p) return;
    const n = (v) => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0);
    for (const slot of SLOTS) if (d[slot] && !p.input[slot]) p.pending[slot] = true;
    p.input = { dx: n(d.dx), dy: n(d.dy), attack: !!d.attack, defense: !!d.defense, super: !!d.super };
    const moving = p.input.dx !== 0 || p.input.dy !== 0, now = Date.now();
    if ((moving || p._wasMoving) && now - (p._inLog || 0) > 1000) {
      p._inLog = now;
      console.log(`[input] ${p.name} dx=${p.input.dx.toFixed(2)} dy=${p.input.dy.toFixed(2)} pos=${Math.round(p.x)},${Math.round(p.y)}`);
    }
    p._wasMoving = moving;
  }

  // Points de spawn par equipe sur sa moitie du toit (B en miroir de A). Quinconce a x distincts:
  // la camera ecrase la profondeur, donc les 4 premiers points sont ecartes en x de 80px (> 1,5x la largeur d'un perso).
  spawnPoints(team) {
    this._spawnPts ||= {};
    if (this._spawnPts[team]) return this._spawnPts[team];
    const W = this.physics.width, H = this.physics.height, margin = CONFIG.PLAYER_RADIUS + 16;
    const cy = H / 2, xs = [112, 192, 272, 352], lo = cy - 80, hi = cy + 80;
    const cand = [...xs.map((x, i) => [x, i % 2 ? lo : hi]), ...xs.map((x, i) => [x, i % 2 ? hi : lo]), [152, cy], [312, cy]];
    const pts = cand.filter(([x, y]) => x < W / 2 && !this.physics.collidesWithWall(x, y, margin, false) && !this.physics.collidesWithWall(W - x, y, margin, false))
      .map(([x, y]) => team === 'A' ? [x, y] : [W - x, y]);
    return (this._spawnPts[team] = pts.length ? pts : [this.arena.spawns?.[team] || [W / 2, cy]]);
  }

  spawn(p, slot = null) {
    const pts = this.spawnPoints(p.team);
    let pt;
    if (slot != null) pt = pts[slot % pts.length];
    else {
      // Reapparition: point libre (aucun perso vivant a moins de 80px) le plus eloigne des ennemis vivants.
      const alive = [...this.players.values()].filter(o => o !== p && o.alive);
      const enemies = alive.filter(o => o.team !== p.team);
      const free = pts.filter(q => !alive.some(o => Math.hypot(o.x - q[0], o.y - q[1]) < 80));
      const score = q => enemies.length ? Math.min(...enemies.map(o => Math.hypot(o.x - q[0], o.y - q[1]))) : -Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]);
      pt = (free.length ? free : pts).reduce((best, q) => score(q) > score(best) ? q : best);
    }
    p.x = pt[0]; p.y = pt[1];
    Object.assign(p, { hp: p.maxHp, alive: true, respawnT: 0, kbVx: 0, kbVy: 0, superKbVx: 0, superKbVy: 0, dashT: 0, dashVx: 0, dashVy: 0,
      mustache:null, uppercutT:0, exfil:null, napT:0, cycleT:0, muskBurn:null, carriedBy:null, combatAt: this.clock || 0, energy: 0, recoveryT: 0, stunT: 0, poseT: 0, recoilT: 0, flashT: 0, launch: null, shove: null, action: null,
      input: {dx: 0, dy: 0}, pending: {}, shieldT: 0, invulnT: 0, protectT: CONFIG.SPAWN_PROTECTION, dx: 0, dy: 0, lastHit: null,
      fx: p.team === 'A' ? 1 : -1, fy: 0, cd: { attack: 0, defense: 0, super: 0 } });
  }

  start() {
    if (this.phase === 'playing') return;
    this.phase = 'playing';
    this.clock = 0;
    this.countdown = COUNTDOWN;
    this.timeLeft = CONFIG.MATCH_DURATION;
    this.score = { A: 0, B: 0 };
    this.projectiles = []; this.zones = []; this.walls = []; this.effects = []; this.events = [];
    this.shuffleTeams(); // avant spawns et compte a rebours: chacun apparait du bon cote
    { const slots = { A: 0, B: 0 }; for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; this.spawn(p, slots[p.team]++); } }
    this.sendLobby();
  }

  // Arret immediat: retour lobby, joueurs gardes, score remis a zero.
  reset() {
    clearTimeout(this.endTimer);
    this.countdown = 0;
    this.phase = 'lobby';
    this.timeLeft = CONFIG.MATCH_DURATION;
    this.score = { A: 0, B: 0 };
    this.projectiles = []; this.zones = []; this.walls = []; this.effects = []; this.events = [];
    this.purgeOffline(); // STOP MATCH: les deconnectes liberent leur perso
    { const slots = { A: 0, B: 0 }; for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; this.spawn(p, slots[p.team]++); } }
    this.sendLobby();
  }

  damage(t, amount, srcId, fromX, fromY, kb = 0, deferKO = false, chargeSource = true, canRingOut = false) {
    if (!t.alive || t.hp <= 0 || t.launch || this.phase !== 'playing' || this.countdown > 0) return false;
    if (t.protectT > 0 || t.invulnT > 0 || isExtracted(t)) return false;
    if (t.shieldT > 0) {
      this.physics.push(t, fromX, fromY, kb * .3);
      if(!t._blkT || Date.now()-t._blkT>250){t._blkT=Date.now();this.events.push({k:'block',id:t.id,x:Math.round(t.x),y:Math.round(t.y),lab:hasLabKit(t)});}
      return false;
    }
    t.exfil=null; // A grounded hit can interrupt approach or landing recovery.
    t.hp = Math.max(0, t.hp - amount); t.flashT = .18;
    // Horloge de combat: coup recu ou donne => pas de regeneration pendant REGEN_DELAY.
    t.combatAt = this.clock || 0; const src = this.players.get(srcId); if (src) src.combatAt = this.clock || 0;
    if(chargeSource)charge(this.players.get(srcId), amount * (src?.char.chargeDealt ?? 1.6)); charge(t, amount * (t.char.chargeTaken ?? .6));
    if (amount >= 1 || !t._hitEvT || Date.now() - t._hitEvT > 250) {
      t._hitEvT = Date.now();
      this.events.push({ k:'hit', id:t.id, x:Math.round(t.x), y:Math.round(t.y), amount:Math.round(amount*10)/10, team:t.team, lab:hasLabKit(t)||hasLabKit(this.players.get(srcId)||{}) });
    }
    t.lastHit = srcId; t.lastHitT = 3;
    if (kb) this.physics.push(t, fromX, fromY, kb, canRingOut);
    if (t.hp <= 0 && !deferKO) this.kill(t, srcId);
    return true;
  }

  kill(t, srcId) {
    t.mustache=null;t.uppercutT=0;
    const fell = t.hp > 0; // tue par la chute hors du toit (et non par les degats)
    t.exfil=null; t.alive = false; t.hp = 0; t.deaths++;
    t.respawnT = respawnDelay(t.deaths); // compteur deaths remis a 0 a START/REMATCH, conserve a la reprise playerKey
    const k = srcId && this.players.get(srcId);
    const credited = k && k !== t && k.team !== t.team;
    if (credited) {
      k.kills++; this.score[k.team]++;
      if (k.alive) k.hp = Math.min(k.maxHp, k.hp + (CONFIG.KILL_HEAL ?? 0)); // soin au kill
    } else { const other = CONFIG.TEAMS.find((x) => x !== t.team); if (other) this.score[other]++; }
    this.events?.push({ k: 'kill', id: t.id, name: t.name, team: t.team, x: Math.round(t.x), y: Math.round(t.y), fell,
      killer: credited ? k.id : null, killerName: credited ? k.name : null, killerTeam: credited ? k.team : null });
  }

  tick(elapsed) {
    const now = Date.now();
    const dt = Math.max(0, Math.min(0.1, elapsed ?? (now - this.last) / 1000));
    this.last = now;
    if (this.phase !== 'playing') return;

    // Compte a rebours: joueurs visibles mais figes, inputs ignores, timer de manche arrete.
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      for (const p of this.players.values()) { p.kbVx = 0; p.kbVy = 0; p.superKbVx = 0; p.superKbVy = 0; }
      if (this.countdown === 0) console.log('[countdown] FIGHT!');
      return;
    }

    this.timeLeft -= dt;
    this.clock = (this.clock || 0) + dt;
    if ((this._ticks = (this._ticks || 0) + 1) % (CONFIG.TICK_RATE * 10) === 0)
      console.log(`[tick] ${Math.ceil(this.timeLeft)}s restantes, ${this.players.size} joueurs, score A${this.score.A}-B${this.score.B}`);
    if (this.timeLeft <= 0) return this.end();

    updateLab(this, dt);
    for (const p of this.players.values()) {
      if (!p.alive) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) this.spawn(p);
        continue;
      }
      advanceExfiltration(p,dt);
      for (const k of ['uppercutT', 'napT', 'cycleT', 'protectT', 'shieldT', 'invulnT', 'lastHitT', 'stunT', 'recoveryT', 'poseT', 'recoilT', 'flashT']) if (p[k] > 0) p[k] -= dt;
      // Regeneration passive lente hors combat.
      if (p.hp > 0 && p.hp < p.maxHp && !p.launch && this.clock - (p.combatAt ?? 0) >= (CONFIG.REGEN_DELAY ?? 3))
        p.hp = Math.min(p.maxHp, p.hp + (CONFIG.REGEN_PER_SEC ?? 0) * dt);
      if (p.lastHitT <= 0) p.lastHit = null;
      for (const s of SLOTS) if (p.cd[s] > 0) p.cd[s] = Math.max(0, p.cd[s] - dt);

      const { dx, dy } = p.input;
      const m = Math.hypot(dx, dy);
      p.dx = m > 1 ? dx / m : dx; p.dy = m > 1 ? dy / m : dy;
      if (m > 0.15) { p.fx = dx / m; p.fy = dy / m; }

      const forced = advanceMustache(this, p, dt) || advanceForcedMovement(this, p, dt);
      if (!forced && p.alive && !(p.napT>0) && !p.exfil) {
        if (p.dashT > 0) {
          const step = Math.min(dt, p.dashT);
          dashHits(this, p); // la charge frappe et pousse ceux qu'elle touche
          this.physics.moveWithWalls(p, p.dashVx * step, p.dashVy * step, p.r, (x, y) =>
            [...this.players.values()].some(o => o !== p && o.alive && !o.launch && !isExtracted(o) && Math.hypot(o.x - x, o.y - y) < o.r + p.r));
          dashHits(this, p);
          p.dashT = Math.max(0, p.dashT - step);
        } else if (p.stunT <= 0 && !(p.cycleT>0)) {
          // Equite: meme vitesse pour tous (BASE_SPEED via characters.json), meme ralentissement juste apres une attaque.
          // Plus d'acceleration pres d'un ennemi ni de regle reservee aux persos labKit.
          let speed = p.char.speed;
          if (p.recoveryT > 0) speed *= RECOVERY_MOVE_SCALE;
          this.physics.moveWithWalls(p, p.dx * speed * dt, p.dy * speed * dt, p.r);
        }
        this.physics.applyKnockback(p, dt);
      }
      for (const slot of SLOTS) {
        const pressed = p.pending[slot] || (p.input[slot] && (slot === 'attack' || !hasLabKit(p)));
        if (pressed) cast(this, p, slot);
      }
      p.pending = {};
    }

    const alive = [...this.players.values()].filter((p) => p.alive&&!isExtracted(p));
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) if (alive[i].mustache?.phase!=='flight' && alive[j].mustache?.phase!=='flight' && !alive[i].launch && !alive[j].launch && !alive[i].carriedBy && !alive[j].carriedBy) {
        const a=alive[i],b=alive[j],sleep=a.napT>0||a.exfil?a:b.napT>0||b.exfil?b:null;
        if(sleep){const other=sleep===a?b:a,dx=other.x-sleep.x,dy=other.y-sleep.y,d=Math.hypot(dx,dy),overlap=a.r+b.r-d;
          if(overlap>0&&!(other.napT>0)&&!other.exfil)this.physics.moveWithWalls(other,(d?dx/d:1)*overlap,(d?dy/d:0)*overlap,other.r);
        }else this.physics.separate(a,b,CONFIG.PLAYER_RADIUS);
      }

    updateMuskBurns(this, dt);
    updateProjectiles(this, dt);
    updateZones(this, dt);

    for (const p of alive) if (p.alive && this.physics.isFalling(p)) this.kill(p, p.lastHit);
  }

  end() {
    this.phase = 'ended';
    this.timeLeft = 0;
    this.projectiles = []; this.zones = []; this.walls = []; this.effects = [];
    const list = [...this.players.values()];
    const mvpP = list.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0];
    const winner = this.score.A === this.score.B ? 'draw' : this.score.A > this.score.B ? 'A' : 'B';
    this.io.emit(MSG.END, {
      score: this.score, winner,
      mvp: mvpP ? { id: mvpP.id, name: mvpP.name, team: mvpP.team, kills: mvpP.kills, character: mvpP.character } : null,
      players: list.map((p) => ({ name: p.name, team: p.team, character: p.character, kills: p.kills, deaths: p.deaths })),
    });
    this.sendLobby();
    this.endTimer = setTimeout(() => { if (this.phase === 'ended') { this.phase = 'lobby'; this.purgeOffline(); this.sendLobby(); } }, END_SCREEN * 1000);
  }

  broadcast() {
    if (this.phase !== 'playing') return;
    const r = (v) => Math.round(v * 10) / 10;
    const state = {
      t: Date.now(),
      countdown: Math.round((this.countdown || 0) * 100) / 100,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, team: p.team, character: p.character,
        x: r(p.x), y: r(p.y), hp: Math.ceil(p.hp), maxHp: p.maxHp, alive: p.alive,
        shield: p.shieldT > 0, dashing: p.dashT > 0, protected: p.protectT > 0,
        fx: r(p.fx), fy: r(p.fy), respawnIn: p.alive ? 0 : Math.max(0, Math.ceil(p.respawnT)),
        kills: p.kills, deaths: p.deaths,
        energy: r(p.energy), pose: r(p.poseT), action: p.action, flash: p.flashT > 0,
        moving: Math.hypot(p.dx,p.dy) > .1 && p.stunT <= 0 && !p.dashT && !(p.napT>0) && !(p.cycleT>0) && !p.exfil && !p.mustache,
        dash: p.dashT > 0 ? {x:p.dashVx,y:p.dashVy,remaining:p.dashT} : null,
        shove: p.shove ? {ux:p.shove.ux,uy:p.shove.uy,progress:1-p.shove.remaining/p.shove.duration} : null,
        launch: p.launch ? {ux:p.launch.ux,uy:p.launch.uy,progress:p.launch.age/p.launch.duration} : null,
        mustache:p.mustache?{phase:p.mustache.phase,age:p.mustache.age,ux:p.mustache.ux,uy:p.mustache.uy,delay:p.mustache.delay,range:p.mustache.range,travel:p.mustache.travel}:undefined, uppercut:p.uppercutT>0?p.uppercutT:undefined,
        exfil:p.exfil?{...p.exfil}:undefined, nap:p.napT>0?p.napT:undefined, cycle:p.cycleT>0?p.cycleT:undefined, recoil: p.recoilT, burning:!!p.muskBurn, carried:!!p.carriedBy,

        cd: { attack: r(p.cd.attack), defense: r(p.cd.defense), super: r(p.cd.super) },
      })),
      projectiles: this.projectiles.map((p) => ({ id: p.id, x: r(p.x), y: r(p.y), r: p.r, team: p.team, visual:p.visual, vx:p.vx, vy:p.vy, height:p.height })),
      zones: this.zones.map((z) => ({ id: z.id, x: r(z.x), y: r(z.y), r: z.r, team: z.team, ttl:z.ttl == null ? undefined : r(z.ttl), kind:z.kind, visual:z.visual, age:z.age, delay:z.delay, duration:z.duration, hit:z.hit, ux:z.ux, uy:z.uy, reach:z.reach, halfAngle:z.halfAngle, owner:z.owner, c:this.players.get(z.owner)?.character })),
      events: this.events.splice(0),
      walls: this.walls.map(w => ({...w})), effects: this.effects.map(e => ({...e})),
      score: this.score,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
    };
    // STATE complet uniquement aux ecrans hotes (room 'hosts'); chaque joueur recoit son petit ME.
    const rooms = typeof this.io.to === 'function';
    (rooms ? this.io.to('hosts') : this.io).emit(MSG.STATE, state);
    if (rooms) {
      for (const p of this.players.values()) this.io.to(p.id).emit(MSG.ME, {
        hp: Math.ceil(p.hp), maxHp: p.maxHp, alive: p.alive, respawnIn: p.alive ? 0 : Math.max(0, Math.ceil(p.respawnT)),
        energy: r(p.energy || 0), cd: { attack: r(p.cd.attack), defense: r(p.cd.defense), super: r(p.cd.super) },
        score: this.score, timeLeft: state.timeLeft, countdown: state.countdown,
      });
    }
    // VIEW: la camera manette cadre toute l'arene, chaque joueur recoit tout le combat (meme format, sans filtre de distance).
    if (rooms) {
      const vs = this._viewStats || (this._viewStats = { bytes: 0, n: 0 });
      const players = state.players.map(slim), zones = state.zones.map(slim), effects = state.effects.map(slim);
      for (const me of state.players) {
        const view = {
          t: state.t, countdown: state.countdown, score: state.score, timeLeft: state.timeLeft, me: me.id,
          players, projectiles: state.projectiles, zones, walls: state.walls, effects, events: state.events,
        };
        this.io.to(me.id).emit(MSG.VIEW, view);
        vs.bytes += JSON.stringify(view).length; vs.n++;
      }
    }
    // Mesure: taille moyenne du STATE et nombre d'ecrans hotes, toutes les 10 s.
    const m = this._stateStats || (this._stateStats = { bytes: 0, n: 0, since: Date.now() });
    m.bytes += JSON.stringify(state).length; m.n++;
    if (Date.now() - m.since >= 10000) {
      const hosts = this.io.sockets?.adapter?.rooms?.get('hosts')?.size ?? 0;
      console.log(`[net] STATE moyen ${Math.round(m.bytes / m.n)} octets (${m.n} envois), ecrans hotes: ${hosts}`);
      const vs = this._viewStats;
      if (vs?.n) console.log(`[net] VIEW moyen ${Math.round(vs.bytes / vs.n)} octets (${vs.n} envois, toute l arene)`);
      this._stateStats = { bytes: 0, n: 0, since: Date.now() }; this._viewStats = { bytes: 0, n: 0 };
    }
  }
}
