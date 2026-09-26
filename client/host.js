import { io } from 'socket.io-client';
import { MSG } from '../shared/protocol.js';
import { render, pushEvents } from './scene.js';
import { SFX } from './sfx.js';
import { Music } from './music.js';
import { createDecor, DECOR_W, DECOR_H } from './decor.js';
import { getSprite, getImage, spriteUrl } from './sprites.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
let lobby = null;
let phase = 'lobby';

// Interpolation: rendu à serverTime - 100 ms
const RENDER_DELAY = 100;
let updates = [], firstT = 0, start = 0;
function resetState() { updates = []; firstT = 0; start = 0; }
function serverTime() { return firstT + (Date.now() - start) - RENDER_DELAY; }
function baseIndex() {
  const t = serverTime();
  for (let i = updates.length - 1; i >= 0; i--) if (updates[i].t <= t) return i;
  return -1;
}
function pushUpdate(u) {
  if (!firstT) { firstT = u.t; start = Date.now(); }
  updates.push(u);
  const b = baseIndex();
  if (b > 0) updates.splice(0, b);
}
const lerp = (a, b, r) => a + (b - a) * r;
function lerpList(l1, l2, r) {
  const m = new Map((l2 || []).map((o) => [o.id, o]));
  return (l1 || []).map((o) => {
    const n = m.get(o.id);
    if(!n)return o;
    const result={...o,x:lerp(o.x,n.x,r),y:lerp(o.y,n.y,r)};
    for(const key of ['age','ttl','pose','recoil'])if(Number.isFinite(o[key])&&Number.isFinite(n[key]))result[key]=lerp(o[key],n[key],r);
    for(const key of ['launch','shove'])if(o[key]&&n[key])result[key]={...o[key],progress:lerp(o[key].progress,n[key].progress,r)};
    return result;
  });
}
function currentState() {
  if (!firstT || !updates.length) return null;
  const b = baseIndex();
  if (b < 0 || b === updates.length - 1) return updates[updates.length - 1];
  const a = updates[b], n = updates[b + 1];
  const r = (serverTime() - a.t) / ((n.t - a.t) || 1);
  return { ...n, players: lerpList(a.players, n.players, r), projectiles: lerpList(a.projectiles, n.projectiles, r), zones: lerpList(a.zones, n.zones, r), walls: lerpList(a.walls,n.walls,r), effects: lerpList(a.effects,n.effects,r) };
}

// Sons déclenchés par diff des snapshots
let lastProj = new Set(), lastHp = new Map();
function sounds(s) {
  try {
    let shot = false;
    const ids = new Set();
    for (const p of s.projectiles || []) { ids.add(p.id); if (!lastProj.has(p.id)) shot = true; }
    lastProj = ids;
    if (shot) SFX.shoot();
    let hit = false, death = false;
    for (const p of s.players || []) {
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
    Music.setPhase(phase);
    $('lobby').style.display = phase === 'lobby' ? 'grid' : 'none';
    $('lobbyBg').style.display = phase === 'lobby' ? 'block' : 'none';
    canvas.style.display = phase === 'lobby' ? 'none' : 'block';
    if (phase === 'lobby') { $('end').style.display = 'none'; resetState(); }
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

function showEnd(d) {
  try {
    const box = $('endBox');
    const w = d.winner === 'A' ? '<span class="A">Victoire des Bleus</span>' : d.winner === 'B' ? '<span class="B">Victoire des Rouges</span>' : 'Égalité';
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let h = `<h1>${w}</h1><h2><span class="A">${d.score?.A ?? 0}</span> : <span class="B">${d.score?.B ?? 0}</span></h2>`;
    if (d.mvp) h += `<p>MVP : <b class="${d.mvp.team}">${esc(d.mvp.name)}</b> (${d.mvp.kills} kills)</p>`;
    h += '<table><tr><th>Joueur</th><th>Kills</th><th>Morts</th></tr>';
    for (const p of [...(d.players || [])].sort((a, b) => b.kills - a.kills))
      h += `<tr><td class="${p.team}">${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`;
    h += '</table><p>Retour au lobby dans quelques secondes...</p>';
    box.innerHTML = h;
    $('end').style.display = 'flex';
    SFX.win();
  } catch (e) {}
}

// Un seul socket persistant pour HOST et START, meme apres un rechargement HMR du module.
const socket = window.__sbHostSocket || (window.__sbHostSocket = io());
socket.off();
let stateLogged = false;
const status = (t) => { try { $('url').dataset.status = t; $('start').title = t; } catch (e) {} };
socket.on('connect', () => { console.log('[host] socket connecte', socket.id, socket.io.engine.transport.name); status(''); try { socket.emit(MSG.HOST); } catch (e) {} });
socket.on('connect_error', (e) => { console.warn('[host] serveur injoignable', e.message); status('serveur injoignable'); $('start').textContent = 'SERVEUR INJOIGNABLE'; });
socket.on('disconnect', (r) => console.warn('[host] deconnecte', r));
socket.on(MSG.LOBBY, (d) => { console.log('[host] LOBBY', d.phase, (d.teams?.A?.length || 0) + (d.teams?.B?.length || 0), 'joueurs'); if (socket.connected) $('start').textContent = 'START MATCH'; showLobby(d); });
socket.on(MSG.STATE, (s) => {
  if (!stateLogged) { stateLogged = true; console.log('[host] premier STATE', s.players.length, 'joueurs'); }
  try {
    if (phase !== 'playing') { phase = 'playing'; Music.setPhase(phase); $('lobby').style.display = 'none'; canvas.style.display = 'block'; }
    pushUpdate(s); sounds(s); pushEvents(s.events);
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
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => Music.unlock(), { capture: true });
function paintMute() { try { const b = $('mute'); const m = Music.isMuted(); b.textContent = m ? '🔇' : '🔊'; b.title = m ? 'Activer la musique' : 'Couper la musique'; b.setAttribute('aria-pressed', String(m)); } catch (e) {} }
try { $('mute').addEventListener('click', (e) => { e.stopPropagation(); Music.unlock(); Music.toggleMute(); paintMute(); }); } catch (e) {}
paintMute();

function loop() {
  try { if (phase === 'lobby') drawLobbyBg(); } catch (e) {}
  try { $('reset').style.display = phase === 'lobby' ? 'none' : 'block'; } catch (e) {}
  try {
    if (phase !== 'lobby') render(ctx, canvas.width, canvas.height, lobby && lobby.arena, currentState(), lobby && lobby.characters);
  } catch (e) {}
  requestAnimationFrame(loop);
}
loop();

// Version qui tourne (SHA du commit), discrete en bas de l'ecran. Rafraichie toutes les 60 s.
function showVersion() {
  fetch('/health', { cache: 'no-store' }).then((r) => r.json()).then((h) => { $('version').textContent = h.sha ? `v ${h.sha}` : ''; }).catch(() => {});
}
showVersion(); setInterval(showVersion, 60000);
