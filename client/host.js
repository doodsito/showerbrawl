import { io } from 'socket.io-client';
import { MSG } from '../shared/protocol.js';
import { render, pushEvents } from './scene.js';
import { preloadCombatArt } from './combat-assets.js';

// Hook d'evenements de combat pour les sons d'action (ou tout autre effet), independant des projectiles.
// Usage: import { onCombatEvent } from './host.js'; onCombatEvent((e) => { if (e.k === 'hit') ... });
// Aussi dispo sans import: window.showerBrawl.onCombatEvent(fn).
// Types: cast {id, slot, type, label, team, x, y} | hit {id, amount, team, x, y} | block {id, x, y}
//        | kill {id, name, team, x, y, fell, killer, killerName, killerTeam}. Renvoie une fonction pour se desabonner.
const COMBAT_KINDS = new Set(['cast', 'hit', 'block', 'kill']);
const combatListeners = new Set();
export function onCombatEvent(fn) { combatListeners.add(fn); return () => combatListeners.delete(fn); }
function emitCombatEvents(events) {
  if (!combatListeners.size || !events) return;
  for (const e of events) if (COMBAT_KINDS.has(e.k)) for (const fn of combatListeners) { try { fn(e); } catch (err) { console.warn('[combat hook]', err); } }
}
window.showerBrawl = Object.assign(window.showerBrawl || {}, { onCombatEvent });
import { SFX } from './sfx.js';
import { Music } from './music.js';
import { createDecor, DECOR_W, DECOR_H } from './decor.js';
import { getSprite, getImage, spriteUrl } from './sprites.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
let lobby = null;
let phase = 'lobby';

// Interpolation: rendu à serverTime - 70 ms, extrapolation courte (50 ms max) si le STATE suivant tarde.
const RENDER_DELAY = 70;
const MAX_EXTRAPOLATION = 50;
let updates = [], clockOffset = null;
function resetState() { updates = []; clockOffset = null; }
// Horloge serveur estimee, recalee en douceur a chaque STATE (derive d'horloge et gigue lissees, jamais de saut).
function serverTime() { return performance.now() + clockOffset - RENDER_DELAY; }
function baseIndex() {
  const t = serverTime();
  for (let i = updates.length - 1; i >= 0; i--) if (updates[i].t <= t) return i;
  return -1;
}
function pushUpdate(u) {
  const off = u.t - performance.now();
  if (clockOffset === null || Math.abs(off - clockOffset) > 500) clockOffset = off;
  else if (off > clockOffset) clockOffset += (off - clockOffset) * 0.1; // paquet en avance: on rattrape vite
  else clockOffset += (off - clockOffset) * 0.02; // paquet en retard (gigue): on recule lentement
  updates.push(u);
  const b = baseIndex();
  if (b > 1) updates.splice(0, b - 1); // garde le snapshot precedent pour pouvoir extrapoler
  if (updates.length > 30) updates.splice(0, updates.length - 30);
}
const lerp = (a, b, r) => a + (b - a) * r;
const LERP_KEYS = ['age', 'ttl', 'pose', 'recoil'], LERP_SUB = ['launch', 'shove'];
const byId = new Map();
function lerpList(l1, l2, r) {
  if (!l1) return [];
  byId.clear();
  if (l2) for (let i = 0; i < l2.length; i++) byId.set(l2[i].id, l2[i]);
  const out = new Array(l1.length);
  for (let i = 0; i < l1.length; i++) {
    const o = l1[i], n = byId.get(o.id);
    if (!n) { out[i] = o; continue; }
    const result = { ...o, x: lerp(o.x, n.x, r), y: lerp(o.y, n.y, r) };
    for (const key of LERP_KEYS) if (Number.isFinite(o[key]) && Number.isFinite(n[key])) result[key] = lerp(o[key], n[key], r);
    for (const key of LERP_SUB) if (o[key] && n[key]) result[key] = { ...o[key], progress: lerp(o[key].progress, n[key].progress, r) };
    out[i] = result;
  }
  return out;
}
function currentState() {
  if (clockOffset === null || !updates.length) return null;
  const b = baseIndex();
  if (b < 0) return updates[updates.length - 1];
  if (b === updates.length - 1) {
    // Aucun STATE plus recent: on prolonge le mouvement des joueurs au plus 50 ms pour eviter un gel.
    const last = updates[b], prev = updates[b - 1];
    if (!prev || last.t <= prev.t) return last;
    const ahead = Math.min(MAX_EXTRAPOLATION, Math.max(0, serverTime() - last.t));
    return { ...last, players: lerpList(prev.players, last.players, 1 + ahead / (last.t - prev.t)) };
  }
  const a = updates[b], n = updates[b + 1];
  const r = Math.min(1, Math.max(0, (serverTime() - a.t) / ((n.t - a.t) || 1)));
  return { ...n, players: lerpList(a.players, n.players, r), projectiles: lerpList(a.projectiles, n.projectiles, r), zones: lerpList(a.zones, n.zones, r), walls: lerpList(a.walls, n.walls, r), effects: lerpList(a.effects, n.effects, r) };
}

// Sons déclenchés par diff des snapshots
// Pouvoirs: sounds/<perso>_<slot>.mp3 sur l'event cast, synthetise si le fichier manque.
let lastHp = new Map();
const charById = new Map();
onCombatEvent((e) => { if (e.k === 'cast') SFX.cast(e.id, charById.get(e.id), e.slot); });
function sounds(s) {
  try {
    let hit = false, death = false;
    for (const p of s.players || []) {
      if (p.character) charById.set(p.id, p.character);
      const prev = lastHp.get(p.id);
      if (prev) {
        if (prev.alive && p.alive === false) death = true;
        else if (p.hp < prev.hp) hit = true;
      }
      lastHp.set(p.id, { hp: p.hp, alive: p.alive });
    }
    if (death) SFX.death(); else if (hit) SFX.hit();
  } catch (e) {}
}

function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

function showLobby(d) {
  try {
    lobby = d; phase = d.phase || 'lobby';
    preloadCombatArt(d.characters);
    Music.setPhase(phase);
    $('lobby').style.display = phase === 'lobby' ? 'grid' : 'none';
    $('lobbyBg').style.display = phase === 'lobby' ? 'block' : 'none';
    canvas.style.display = phase === 'lobby' ? 'none' : 'block';
    if (phase === 'lobby') { $('end').style.display = 'none'; clearInterval(endTimer); resetState(); }
    if (d.qr) $('qr').src = d.qr;
    if (d.url) $('url').textContent = d.url;
    renderSlots(d);
    renderRoster(d.characters || {});
  } catch (e) {}
}

// Sprite deja configure pour le perso: PNG si sprite est un chemin (ou sprites/<id>.png), sinon crane runtime.
function spriteEl(ch, id) {
  const url = spriteUrl(ch && ch.sprite, id);
  const im = document.createElement('img'); im.alt = '';
  const skull = () => { try { const c = getSprite(id); if (!c) return null; const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; k.getContext('2d').drawImage(c, 0, 0); k.style.height = '70%'; return k; } catch (e) { return null; } };
  if (!url) return skull() || im;
  im.onerror = () => { const k = skull(); if (k) im.replaceWith(k); else im.remove(); };
  im.src = url; getImage(ch && ch.sprite, id);
  return im;
}

const SLOTS_PER_TEAM = 4;
function renderSlots(d) {
  for (const t of ['A', 'B']) {
    const ul = document.querySelector(`#team${t} ul`);
    ul.innerHTML = '';
    const players = (d.teams && d.teams[t]) || [];
    const n = Math.max(SLOTS_PER_TEAM, players.length); // au-dela de 4, on ajoute des slots (limite joueurs inchangee)
    ul.style.gap = n > SLOTS_PER_TEAM ? '.4vh' : '';
    for (let i = 0; i < n; i++) {
      const p = players[i];
      const li = document.createElement('li');
      if (n > SLOTS_PER_TEAM) li.style.height = `min(8.4vh, ${Math.floor(56 / n)}vh)`;
      if (!p) {
        li.className = 'slot empty';
        li.innerHTML = '<span class="plus">+</span><span>WAITING FOR PLAYER...</span>';
      } else {
        const ch = d.characters && d.characters[p.character];
        li.className = 'slot on';
        const spr = document.createElement('span'); spr.className = 'spr'; spr.appendChild(spriteEl(ch, p.character));
        const txt = document.createElement('span'); txt.className = 'txt';
        const pn = document.createElement('span'); pn.className = 'pn'; pn.textContent = p.name || '?';
        const cn = document.createElement('span'); cn.className = 'cn'; cn.textContent = ch ? ch.name : p.character;
        txt.append(pn, cn);
        if (t === 'B') { li.style.flexDirection = 'row-reverse'; txt.style.alignItems = 'flex-end'; }
        li.append(spr, txt);
      }
      ul.appendChild(li);
    }
  }
}

// Bande roster non interactive: les persos de characters.json (le choix reste sur /play/).
let rosterKey = '';
function renderRoster(chars) {
  const ids = Object.keys(chars);
  const key = ids.map((id) => id + chars[id].sprite).join('|');
  if (key === rosterKey) return;
  rosterKey = key;
  const box = $('roster'); box.innerHTML = '';
  const t = document.createElement('span'); t.className = 't'; t.textContent = `${ids.length} CHARACTERS`; box.appendChild(t);
  for (const id of ids) {
    const r = document.createElement('div'); r.className = 'r';
    const s = document.createElement('div'); s.className = 'spr'; s.appendChild(spriteEl(chars[id], id));
    const n = document.createElement('span'); n.textContent = chars[id].name || id;
    r.append(s, n); box.appendChild(r);
  }
}

// Fond du lobby: decor Maison Blanche (client/decor.js), anime, en "cover".
let lobbyDecor = null;
function drawLobbyBg() {
  const c = $('lobbyBg');
  if (c.width !== innerWidth || c.height !== innerHeight) { c.width = innerWidth; c.height = innerHeight; }
  const g = c.getContext('2d');
  if (!lobbyDecor) lobbyDecor = createDecor();
  const k = Math.max(c.width / DECOR_W, c.height / DECOR_H);
  g.setTransform(k, 0, 0, k, (c.width - DECOR_W * k) / 2, (c.height - DECOR_H * k) / 2);
  g.imageSmoothingEnabled = false;
  g.drawImage(lobbyDecor.background, 0, 0);
  lobbyDecor.animate(g, performance.now() / 1000);
  lobbyDecor.foreground(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// Ecran de fin: VICTORY + equipe gagnante, score, sprite du meilleur joueur. Retour lobby auto (serveur) ou REJOUER (RESET).
let endTimer = null;
function showEnd(d) {
  try {
    const box = $('endBox');
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const win = d.winner === 'A' ? ['A', 'TEAM BLEUE WINS'] : d.winner === 'B' ? ['B', 'TEAM ROUGE WINS'] : ['draw', 'EGALITE'];
    box.innerHTML = `<div class="victory">${win[0] === 'draw' ? 'FIN DU MATCH' : 'VICTORY'}</div>
      <div class="winner ${win[0]}">${win[1]}</div>
      <div class="score"><div class="A">${d.score?.A ?? 0}<small>BLEUS</small></div><div class="vs">VS</div><div class="B">${d.score?.B ?? 0}<small>ROUGES</small></div></div>
      <div class="mvp"></div>
      <div class="foot"><span id="endCount"></span><button id="replay">REJOUER</button></div>`;
    const m = d.mvp, chars = (lobby && lobby.characters) || {};
    if (m) {
      const ch = chars[m.character];
      const spr = document.createElement('div'); spr.className = 'spr'; spr.appendChild(spriteEl(ch, m.character));
      const t = document.createElement('div'); t.className = 't';
      t.innerHTML = `<div class="lab">MVP</div><div class="nm ${m.team}" style="color:var(--${m.team === 'A' ? 'blueL' : 'redL'})">${esc(m.name)}</div><div class="ch">${esc(ch ? ch.name : m.character)} · ${m.kills} KILL${m.kills > 1 ? 'S' : ''}</div>`;
      box.querySelector('.mvp').append(spr, t);
    }
    $('replay').onclick = (e) => { e.stopPropagation(); socket.emit(MSG.RESET, (r) => console.log('[host] REJOUER -> RESET', r)); };
    let n = 6; const tickEnd = () => { const c = $('endCount'); if (c) c.textContent = n > 0 ? `RETOUR AU LOBBY DANS ${n}S` : ''; n--; };
    clearInterval(endTimer); tickEnd(); endTimer = setInterval(tickEnd, 1000);
    $('end').style.display = 'flex';
    SFX.end(win[0] === 'draw');
  } catch (e) { console.warn('[host] ecran de fin', e); }
}

// Un seul socket persistant pour HOST et START, meme apres un rechargement HMR du module.
const socket = window.__sbHostSocket || (window.__sbHostSocket = io());
socket.off();
let stateLogged = false;
const status = (t) => { try { $('url').dataset.status = t; $('start').title = t; } catch (e) {} };
socket.on('connect', () => { console.log('[host] socket connecte', socket.id, socket.io.engine.transport.name); status(''); try { socket.emit(MSG.HOST); } catch (e) {} });
socket.on('connect_error', (e) => { console.warn('[host] serveur injoignable', e.message); status('serveur injoignable'); $('start').textContent = 'SERVEUR INJOIGNABLE'; });
socket.on('disconnect', (r) => console.warn('[host] deconnecte', r));
socket.on(MSG.LOBBY, (d) => { try { SFX.setCharacters(Object.keys(d.characters || {})); } catch (e) {} console.log('[host] LOBBY', d.phase, (d.teams?.A?.length || 0) + (d.teams?.B?.length || 0), 'joueurs'); if (socket.connected) $('start').textContent = 'START MATCH'; showLobby(d); });
socket.on(MSG.STATE, (s) => {
  if (!stateLogged) { stateLogged = true; console.log('[host] premier STATE', s.players.length, 'joueurs'); }
  try {
    if (phase !== 'playing') { phase = 'playing'; Music.setPhase(phase); $('lobby').style.display = 'none'; canvas.style.display = 'block'; }
    pushUpdate(s); sounds(s); pushEvents(s.events); emitCombatEvents(s.events);
  } catch (e) {}
});
socket.on(MSG.END, showEnd);
if (socket.connected) socket.emit(MSG.HOST); // module recharge: redemande le lobby

// Delegation sur document: survit a tout re-rendu du lobby. Emit AVANT l'audio pour qu'une erreur SFX ne le bloque jamais.
if (window.__sbStartHandler) document.removeEventListener('click', window.__sbStartHandler);
window.__sbStartHandler = (e) => {
  if (!e.target.closest?.('#start')) return;
  console.log('[host] START clicked, emitting', socket.id, 'connecte =', socket.connected);
  socket.emit(MSG.START, (r) => console.log('[host] START ack', r));
  try { SFX.init(); } catch (err) {}
};
document.addEventListener('click', window.__sbStartHandler);

// Bouton ARRETER LA MANCHE: retour lobby immediat (serveur garde les joueurs).
if (window.__sbResetHandler) document.removeEventListener('click', window.__sbResetHandler);
window.__sbResetHandler = (e) => {
  if (!e.target.closest?.('#reset')) return;
  console.log('[host] RESET clicked, emitting', socket.id);
  socket.emit(MSG.RESET, (r) => console.log('[host] RESET ack', r));
};
document.addEventListener('click', window.__sbResetHandler);
addEventListener('pointerdown', () => { try { SFX.init(); } catch (e) {} });

// Musique: demarre au premier geste (autoplay policy, Safari compris), bouton mute retenu.
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => { Music.unlock(); try { SFX.init(); } catch (e) {} }, { capture: true });
function paintMute() { try { const b = $('mute'); const m = Music.isMuted(); b.textContent = m ? '🔇' : '🔊'; b.title = m ? 'Activer la musique' : 'Couper la musique'; b.setAttribute('aria-pressed', String(m)); } catch (e) {} }
try { $('mute').addEventListener('click', (e) => { e.stopPropagation(); Music.unlock(); Music.toggleMute(); SFX.setMuted(Music.isMuted()); paintMute(); }); } catch (e) {}
paintMute();
SFX.setMuted(Music.isMuted());

// Compte a rebours au START: 3, 2, 1 pilotes par state.countdown (serveur), puis FIGHT! 1 s.
let cdShown = '', fightUntil = 0, lastCd = 0;
function updateCountdown(st) {
  const el = $('countdown'), span = el.firstElementChild;
  const cd = phase === 'playing' && st ? st.countdown || 0 : 0;
  const now = performance.now();
  if (lastCd > 0 && cd === 0 && phase === 'playing') fightUntil = now + 1000;
  lastCd = cd;
  const txt = cd > 2 ? '3' : cd > 1 ? '2' : cd > 0 ? '1' : now < fightUntil ? 'FIGHT!' : '';
  if (txt === cdShown) return;
  cdShown = txt;
  el.style.display = txt ? 'flex' : 'none';
  span.textContent = txt;
  span.className = txt === 'FIGHT!' ? 'fight' : '';
  void span.offsetWidth; span.classList.add('pop'); // relance l'animation a chaque chiffre
}

// Compteur FPS discret (?fps=1), a cote du SHA. Mis a jour 2x/s, dt reel entre frames rAF.
const SHOW_FPS = new URLSearchParams(location.search).get('fps') === '1';
const fpsEl = SHOW_FPS ? $('fps') : null;
if (fpsEl) fpsEl.style.display = 'block';
let fpsFrames = 0, fpsAcc = 0, fpsWorst = 0, lastFrame = performance.now();
const resetBtn = $('reset');
let resetShown = null;

function loop(now) {
  const dt = now - lastFrame; lastFrame = now;
  if (fpsEl) {
    fpsFrames++; fpsAcc += dt; if (dt > fpsWorst) fpsWorst = dt;
    if (fpsAcc >= 500) { fpsEl.textContent = `${Math.round(fpsFrames * 1000 / fpsAcc)} fps · pire ${fpsWorst.toFixed(0)} ms`; fpsFrames = 0; fpsAcc = 0; fpsWorst = 0; }
  }
  try { if (phase === 'lobby') drawLobbyBg(); } catch (e) {}
  const show = phase !== 'lobby';
  if (show !== resetShown) { resetShown = show; try { resetBtn.style.display = show ? 'block' : 'none'; } catch (e) {} }
  try {
    const st = show ? currentState() : null;
    if (show) render(ctx, canvas.width, canvas.height, lobby && lobby.arena, st, lobby && lobby.characters);
    updateCountdown(st);
  } catch (e) {}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Version qui tourne (SHA du commit), discrete en bas de l'ecran. Rafraichie toutes les 60 s.
function showVersion() {
  fetch('/health', { cache: 'no-store' }).then((r) => r.json()).then((h) => { $('version').textContent = h.sha ? `v ${h.sha}` : ''; }).catch(() => {});
}
showVersion(); setInterval(showVersion, 60000);
