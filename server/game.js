// Boucle autoritaire: une salle publique, 2 equipes, manche au timer.
import { CONFIG } from '../shared/config.js';
import { MSG } from '../shared/protocol.js';
import { makePhysics } from './physics.js';
import { cast, updateProjectiles, updateZones } from './abilities.js';

const SLOTS = ['attack', 'defense', 'super'];
const END_SCREEN = 10; // s avant retour lobby

export class Game {
  constructor(io, { characters, arena, lobbyExtra = {} }) {
    this.io = io;
    this.characters = characters;
    this.arena = arena;
    this.physics = makePhysics(arena);
    this.lobbyExtra = lobbyExtra;
    this.players = new Map();
    this.projectiles = [];
    this.zones = [];
    this.score = { A: 0, B: 0 };
    this.phase = 'lobby';
    this.timeLeft = CONFIG.MATCH_DURATION;
    this._id = 1;
    this.nextId = () => this._id++;
    this.damage = this.damage.bind(this);
    this.last = Date.now();
    setInterval(() => { try { this.tick(); } catch (e) { console.warn('[tick]', e.message); } }, 1000 / CONFIG.TICK_RATE);
    setInterval(() => { try { this.broadcast(); } catch {} }, 1000 / CONFIG.BROADCAST_RATE);
  }

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
    for (const o of this.players.values())
      if (o.id !== socket.id && o.team === team && o.character === data.character) return { ok: false, error: 'perso deja pris' };
    const name = String(data.name || char.name).slice(0, 16);
    const p = existing || { id: socket.id, kills: 0, deaths: 0, input: { dx: 0, dy: 0 } };
    Object.assign(p, { team, character: data.character, char, name, maxHp: char.hp, r: CONFIG.PLAYER_RADIUS });
    this.players.set(socket.id, p);
    this.spawn(p);
    this.sendLobby();
    return { ok: true, id: socket.id };
  }

  leave(id) { if (this.players.delete(id)) this.sendLobby(); }

  input(id, d = {}) {
    const p = this.players.get(id);
    if (!p) return;
    const n = (v) => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0);
    p.input = { dx: n(d.dx), dy: n(d.dy), attack: !!d.attack, defense: !!d.defense, super: !!d.super };
  }

  spawn(p) {
    const s = this.arena.spawns?.[p.team] || [this.physics.width / 2, this.physics.height / 2];
    for (let i = 0; i < 20; i++) {
      p.x = s[0] + (Math.random() - 0.5) * 80; p.y = s[1] + (Math.random() - 0.5) * 80;
      if (!this.physics.collidesWithWall(p.x, p.y, p.r)) break;
      p.x = s[0]; p.y = s[1];
    }
    Object.assign(p, { hp: p.maxHp, alive: true, respawnT: 0, kbVx: 0, kbVy: 0, dashT: 0, dashVx: 0, dashVy: 0,
      shieldT: 0, invulnT: 0, protectT: CONFIG.SPAWN_PROTECTION, dx: 0, dy: 0, lastHit: null,
      fx: p.team === 'A' ? 1 : -1, fy: 0, cd: { attack: 0, defense: 0, super: 0 } });
  }

  start() {
    if (this.phase === 'playing') return;
    this.phase = 'playing';
    this.timeLeft = CONFIG.MATCH_DURATION;
    this.score = { A: 0, B: 0 };
    this.projectiles = []; this.zones = [];
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; this.spawn(p); }
    this.sendLobby();
  }

  damage(t, amount, srcId, fromX, fromY, kb = 0) {
    if (!t.alive || this.phase !== 'playing') return;
    if (t.protectT > 0 || t.invulnT > 0) return;
    if (t.shieldT > 0) { this.physics.push(t, fromX, fromY, kb * 0.3); return; }
    t.hp -= amount;
    t.lastHit = srcId; t.lastHitT = 3;
    if (kb) this.physics.push(t, fromX, fromY, kb);
    if (t.hp <= 0) this.kill(t, srcId);
  }

  kill(t, srcId) {
    t.alive = false; t.hp = 0; t.deaths++;
    t.respawnT = CONFIG.RESPAWN_TIME;
    const k = srcId && this.players.get(srcId);
    if (k && k !== t && k.team !== t.team) { k.kills++; this.score[k.team]++; }
    else { const other = CONFIG.TEAMS.find((x) => x !== t.team); if (other) this.score[other]++; }
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.phase !== 'playing') return;

    this.timeLeft -= dt;
    if ((this._ticks = (this._ticks || 0) + 1) % (CONFIG.TICK_RATE * 10) === 0)
      console.log(`[tick] ${Math.ceil(this.timeLeft)}s restantes, ${this.players.size} joueurs, score A${this.score.A}-B${this.score.B}`);
    if (this.timeLeft <= 0) return this.end();

    for (const p of this.players.values()) {
      if (!p.alive) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) this.spawn(p);
        continue;
      }
      for (const k of ['protectT', 'shieldT', 'invulnT', 'lastHitT']) if (p[k] > 0) p[k] -= dt;
      if (p.lastHitT <= 0) p.lastHit = null;
      for (const s of SLOTS) if (p.cd[s] > 0) p.cd[s] = Math.max(0, p.cd[s] - dt);

      const { dx, dy } = p.input;
      const m = Math.hypot(dx, dy);
      p.dx = m > 1 ? dx / m : dx; p.dy = m > 1 ? dy / m : dy;
      if (m > 0.15) { p.fx = dx / m; p.fy = dy / m; }

      if (p.dashT > 0) {
        p.dashT -= dt;
        this.physics.moveWithWalls(p, p.dashVx * dt, p.dashVy * dt, p.r);
      } else {
        this.physics.moveWithWalls(p, p.dx * p.char.speed * dt, p.dy * p.char.speed * dt, p.r);
      }
      this.physics.applyKnockback(p, dt);

      for (const s of SLOTS) if (p.input[s]) cast(this, p, s);
      if (p.input.attack && p.protectT > 0 && p.cd.attack > 0) p.protectT = 0; // tirer annule la protection
    }

    const alive = [...this.players.values()].filter((p) => p.alive);
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) this.physics.separate(alive[i], alive[j], CONFIG.PLAYER_RADIUS);

    updateProjectiles(this, dt);
    updateZones(this, dt);

    for (const p of alive) if (p.alive && this.physics.isFalling(p)) this.kill(p, p.lastHit);
  }

  end() {
    this.phase = 'ended';
    this.timeLeft = 0;
    this.projectiles = []; this.zones = [];
    const list = [...this.players.values()];
    const mvpP = list.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0];
    const winner = this.score.A === this.score.B ? 'draw' : this.score.A > this.score.B ? 'A' : 'B';
    this.io.emit(MSG.END, {
      score: this.score, winner,
      mvp: mvpP ? { id: mvpP.id, name: mvpP.name, team: mvpP.team, kills: mvpP.kills, character: mvpP.character } : null,
      players: list.map((p) => ({ name: p.name, team: p.team, character: p.character, kills: p.kills, deaths: p.deaths })),
    });
    this.sendLobby();
    setTimeout(() => { if (this.phase === 'ended') { this.phase = 'lobby'; this.sendLobby(); } }, END_SCREEN * 1000);
  }

  broadcast() {
    if (this.phase !== 'playing') return;
    const r = (v) => Math.round(v * 10) / 10;
    this.io.emit(MSG.STATE, {
      t: Date.now(),
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, team: p.team, character: p.character,
        x: r(p.x), y: r(p.y), hp: Math.ceil(p.hp), maxHp: p.maxHp, alive: p.alive,
        shield: p.shieldT > 0 || p.invulnT > 0, protected: p.protectT > 0,
        fx: r(p.fx), fy: r(p.fy), respawnIn: p.alive ? 0 : Math.max(0, Math.ceil(p.respawnT)),
        kills: p.kills, deaths: p.deaths,
        cd: { attack: r(p.cd.attack), defense: r(p.cd.defense), super: r(p.cd.super) },
      })),
      projectiles: this.projectiles.map((p) => ({ id: p.id, x: r(p.x), y: r(p.y), r: p.r, team: p.team })),
      zones: this.zones.map((z) => ({ id: z.id, x: r(z.x), y: r(z.y), r: z.r, team: z.team })),
      score: this.score,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
    });
  }
}
