import { io } from 'socket.io-client';
import { MSG } from '../shared/protocol.js';
import { render } from './scene.js';
import { SFX } from './sfx.js';

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
    return n ? { ...o, x: lerp(o.x, n.x, r), y: lerp(o.y, n.y, r) } : o;
  });
}
function currentState() {
  if (!firstT || !updates.length) return null;
  const b = baseIndex();
  if (b < 0 || b === updates.length - 1) return updates[updates.length - 1];
  const a = updates[b], n = updates[b + 1];
  const r = (serverTime() - a.t) / ((n.t - a.t) || 1);
  return { ...n, players: lerpList(a.players, n.players, r), projectiles: lerpList(a.projectiles, n.projectiles, r), zones: lerpList(a.zones, n.zones, r) };
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
    $('lobby').style.display = phase === 'lobby' ? 'flex' : 'none';
    canvas.style.display = phase === 'lobby' ? 'none' : 'block';
    if (phase === 'lobby') { $('end').style.display = 'none'; resetState(); }
    if (d.qr) $('qr').src = d.qr;
    if (d.url) $('url').textContent = d.url;
    for (const t of ['A', 'B']) {
      const ul = document.querySelector(`#team${t} ul`);
      ul.innerHTML = '';
      for (const p of (d.teams && d.teams[t]) || []) {
        const li = document.createElement('li');
        const ch = d.characters && d.characters[p.character];
        li.textContent = `${p.name}${ch ? ' (' + ch.name + ')' : ''}`;
        ul.appendChild(li);
      }
    }
  } catch (e) {}
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
socket.on(MSG.LOBBY, (d) => { console.log('[host] LOBBY', d.phase, (d.teams?.A?.length || 0) + (d.teams?.B?.length || 0), 'joueurs'); if (socket.connected) $('start').textContent = 'START'; showLobby(d); });
socket.on(MSG.STATE, (s) => {
  if (!stateLogged) { stateLogged = true; console.log('[host] premier STATE', s.players.length, 'joueurs'); }
  try {
    if (phase !== 'playing') { phase = 'playing'; $('lobby').style.display = 'none'; canvas.style.display = 'block'; }
    pushUpdate(s); sounds(s);
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
addEventListener('pointerdown', () => { try { SFX.init(); } catch (e) {} });

function loop() {
  try {
    if (phase !== 'lobby') render(ctx, canvas.width, canvas.height, lobby && lobby.arena, currentState(), lobby && lobby.characters);
  } catch (e) {}
  requestAnimationFrame(loop);
}
loop();
