// Boucle autoritaire: une salle publique, 2 equipes, manche au timer.
import { CONFIG } from '../shared/config.js';
import { MSG } from '../shared/protocol.js';
import { makePhysics } from './physics.js';
import { cast, updateProjectiles, updateZones } from './abilities.js';
import { isLabFighter, charge, updateLab, advanceForcedMovement } from './lab-combat.js';

const SLOTS = ['attack', 'defense', 'super'];
const END_SCREEN = 6; // s d'ecran de victoire avant retour lobby
const COUNTDOWN = 3; // s de 3-2-1 avant FIGHT!, joueurs figes, timer arrete

export class Game {
  constructor(io, { characters, arena, lobbyExtra = {}, autoTick = true }) {
    this.io = io;
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

  dispose() { for (const timer of this.timers) clearInterval(timer); clearTimeout(this.endTimer); }

  lobbyPayload() {
    const teams = { A: [], B: [] };
    for (const p of this.players.values()) teams[p.team]?.push({ id: p.id, name: p.name, character: p.character });
    return { phase: this.phase, teams, characters: this.characters,
      arena: { cellSize: this.arena.cellSize, grid: this.arena.grid, spawns: this.arena.spawns, obstacles: this.arena.obstacles },
      ...this.lobbyExtra };
  }
  sendLobby(target = this.io) { target.emit(MSG.LOBBY, this.lobbyPayload()); }

  join(socket, data = {}) {
    const team = CONFIG.TEAMS.includes(data.team) ? data.team : null;
    const char = this.characters[data.character];
    if (!team || !char) return { ok: false, error: 'equipe ou perso invalide' };
    const existing = this.players.get(socket.id);
    if (!existing && this.players.size >= CONFIG.MAX_PLAYERS) return { ok: false, error: 'salle pleine' };
    // Perso unique par equipe tant qu'il en reste un libre; sinon doublons autorises (10v10 avec peu de persos).
    const usedInTeam = new Set([...this.players.values()].filter((o) => o.id !== socket.id && o.team === team).map((o) => o.character));
    const freeLeft = Object.keys(this.characters).some((c) => !usedInTeam.has(c));
    if (freeLeft && usedInTeam.has(data.character)) return { ok: false, error: 'perso deja pris' };
    const name = String(data.name || char.name).slice(0, 16);
    const p = existing || { id: socket.id, kills: 0, deaths: 0, input: { dx: 0, dy: 0 } };
    Object.assign(p, { team, character: data.character, char, name, maxHp: char.hp, r: CONFIG.PLAYER_RADIUS });
    this.players.set(socket.id, p);
    this.spawn(p); // en phase playing, le joueur apparait directement dans l'arene
    this.sendLobby();
    return { ok: true, id: socket.id, phase: this.phase };
  }

  leave(id) { if (this.players.delete(id)) this.sendLobby(); }

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

  spawn(p) {
    const s = this.arena.spawns?.[p.team] || [this.physics.width / 2, this.physics.height / 2];
    for (let i = 0; i < 20; i++) {
      p.x = s[0] + (Math.random() - 0.5) * 80; p.y = s[1] + (Math.random() - 0.5) * 80;
      if (!this.physics.collidesWithWall(p.x, p.y, p.r)) break;
      p.x = s[0]; p.y = s[1];
    }
    Object.assign(p, { hp: p.maxHp, alive: true, respawnT: 0, kbVx: 0, kbVy: 0, dashT: 0, dashVx: 0, dashVy: 0,
      energy: 0, stunT: 0, poseT: 0, recoilT: 0, flashT: 0, launch: null, shove: null, action: null,
      input: {dx: 0, dy: 0}, pending: {}, shieldT: 0, invulnT: 0, protectT: CONFIG.SPAWN_PROTECTION, dx: 0, dy: 0, lastHit: null,
      fx: p.team === 'A' ? 1 : -1, fy: 0, cd: { attack: 0, defense: 0, super: 0 } });
  }

  start() {
    if (this.phase === 'playing') return;
    this.phase = 'playing';
    this.countdown = COUNTDOWN;
    this.timeLeft = CONFIG.MATCH_DURATION;
    this.score = { A: 0, B: 0 };
    this.projectiles = []; this.zones = []; this.walls = []; this.effects = []; this.events = [];
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; this.spawn(p); }
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
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; this.spawn(p); }
    this.sendLobby();
  }

  damage(t, amount, srcId, fromX, fromY, kb = 0, deferKO = false, chargeSource = true) {
    if (!t.alive || t.hp <= 0 || t.launch || this.phase !== 'playing' || this.countdown > 0) return false;
    if (t.protectT > 0 || t.invulnT > 0) return false;
    if (t.shieldT > 0) {
      this.physics.push(t, fromX, fromY, kb * .3);
      if(!t._blkT || Date.now()-t._blkT>250){t._blkT=Date.now();this.events.push({k:'block',id:t.id,x:Math.round(t.x),y:Math.round(t.y),lab:isLabFighter(t)});}
      return false;
    }
    t.hp = Math.max(0, t.hp - amount); t.flashT = .18;
    if(chargeSource)charge(this.players.get(srcId), amount * 2.2); charge(t, amount);
    if (amount >= 1 || !t._hitEvT || Date.now() - t._hitEvT > 250) {
      t._hitEvT = Date.now();
      this.events.push({ k:'hit', id:t.id, x:Math.round(t.x), y:Math.round(t.y), amount:Math.round(amount*10)/10, team:t.team, lab:isLabFighter(t)||isLabFighter(this.players.get(srcId)||{}) });
    }
    t.lastHit = srcId; t.lastHitT = 3;
    if (kb) this.physics.push(t, fromX, fromY, kb);
    if (t.hp <= 0 && !deferKO) this.kill(t, srcId);
    return true;
  }

  kill(t, srcId) {
    t.alive = false; t.hp = 0; t.deaths++;
    t.respawnT = CONFIG.RESPAWN_TIME;
    const k = srcId && this.players.get(srcId);
    if (k && k !== t && k.team !== t.team) { k.kills++; this.score[k.team]++; }
    else { const other = CONFIG.TEAMS.find((x) => x !== t.team); if (other) this.score[other]++; }
  }

  tick(elapsed) {
    const now = Date.now();
    const dt = Math.max(0, Math.min(0.1, elapsed ?? (now - this.last) / 1000));
    this.last = now;
    if (this.phase !== 'playing') return;

    // Compte a rebours: joueurs visibles mais figes, inputs ignores, timer de manche arrete.
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      for (const p of this.players.values()) { p.kbVx = 0; p.kbVy = 0; }
      if (this.countdown === 0) console.log('[countdown] FIGHT!');
      return;
    }

    this.timeLeft -= dt;
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
      for (const k of ['protectT', 'shieldT', 'invulnT', 'lastHitT', 'stunT', 'poseT', 'recoilT', 'flashT']) if (p[k] > 0) p[k] -= dt;
      if (p.lastHitT <= 0) p.lastHit = null;
      for (const s of SLOTS) if (p.cd[s] > 0) p.cd[s] = Math.max(0, p.cd[s] - dt);

      const { dx, dy } = p.input;
      const m = Math.hypot(dx, dy);
      p.dx = m > 1 ? dx / m : dx; p.dy = m > 1 ? dy / m : dy;
      if (m > 0.15) { p.fx = dx / m; p.fy = dy / m; }

      const forced = advanceForcedMovement(this, p, dt);
      if (!forced && p.alive) {
        if (p.dashT > 0) {
          const step = Math.min(dt, p.dashT); p.dashT = Math.max(0, p.dashT - step);
          this.physics.moveWithWalls(p, p.dashVx * step, p.dashVy * step, p.r, (x, y) =>
            [...this.players.values()].some(o => o !== p && o.alive && !o.launch && Math.hypot(o.x - x, o.y - y) < o.r + p.r));
        } else if (p.stunT <= 0) {
          let speed = p.char.speed;
          if (isLabFighter(p)) {
            const near = [...this.players.values()].filter(o => o !== p && o.alive && o.team !== p.team)
              .sort((a, b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
            const d = near && Math.hypot(p.x-near.x,p.y-near.y);
            if (p.cd.attack > 0 || p.cd.super > 0) speed *= .45;
            else if (d > 0 && d < 160 && p.dx*(p.x-near.x)+p.dy*(p.y-near.y) > d*.35) speed = 300;
          }
          this.physics.moveWithWalls(p, p.dx * speed * dt, p.dy * speed * dt, p.r);
        }
        this.physics.applyKnockback(p, dt);
      }
      for (const slot of SLOTS) {
        const pressed = p.pending[slot] || (p.input[slot] && (slot === 'attack' || !isLabFighter(p)));
        if (pressed) cast(this, p, slot);
      }
      p.pending = {};
    }

    const alive = [...this.players.values()].filter((p) => p.alive);
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) if (!alive[i].launch && !alive[j].launch) this.physics.separate(alive[i], alive[j], CONFIG.PLAYER_RADIUS);

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
    this.endTimer = setTimeout(() => { if (this.phase === 'ended') { this.phase = 'lobby'; this.sendLobby(); } }, END_SCREEN * 1000);
  }

  broadcast() {
    if (this.phase !== 'playing') return;
    const r = (v) => Math.round(v * 10) / 10;
    this.io.emit(MSG.STATE, {
      t: Date.now(),
      countdown: Math.round((this.countdown || 0) * 100) / 100,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, team: p.team, character: p.character,
        x: r(p.x), y: r(p.y), hp: Math.ceil(p.hp), maxHp: p.maxHp, alive: p.alive,
        shield: p.shieldT > 0, dashing: p.dashT > 0, protected: p.protectT > 0,
        fx: r(p.fx), fy: r(p.fy), respawnIn: p.alive ? 0 : Math.max(0, Math.ceil(p.respawnT)),
        kills: p.kills, deaths: p.deaths,
        energy: r(p.energy), pose: r(p.poseT), action: p.action, flash: p.flashT > 0,
        moving: Math.hypot(p.dx,p.dy) > .1 && p.stunT <= 0 && !p.dashT,
        dash: p.dashT > 0 ? {x:p.dashVx,y:p.dashVy,remaining:p.dashT} : null,
        shove: p.shove ? {ux:p.shove.ux,uy:p.shove.uy,progress:1-p.shove.remaining/p.shove.duration} : null,
        launch: p.launch ? {ux:p.launch.ux,uy:p.launch.uy,progress:p.launch.age/p.launch.duration} : null,
        recoil: p.recoilT,

        cd: { attack: r(p.cd.attack), defense: r(p.cd.defense), super: r(p.cd.super) },
      })),
      projectiles: this.projectiles.map((p) => ({ id: p.id, x: r(p.x), y: r(p.y), r: p.r, team: p.team, visual:p.visual, vx:p.vx, vy:p.vy })),
      zones: this.zones.map((z) => ({ id: z.id, x: r(z.x), y: r(z.y), r: z.r, team: z.team, ttl:z.ttl == null ? undefined : r(z.ttl), kind:z.kind, age:z.age, delay:z.delay, duration:z.duration, hit:z.hit })),
      events: this.events.splice(0),
      walls: this.walls.map(w => ({...w})), effects: this.effects.map(e => ({...e})),
      score: this.score,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
    });
  }
}
