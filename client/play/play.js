import nipplejs from 'nipplejs';
import { io } from 'socket.io-client';
import { MSG } from '../../shared/protocol.js';

const $ = (s) => document.querySelector(s);
const socket = io();
let stateLogged = false;
socket.on('connect', () => {
  console.log('[play] socket connecte', socket.id);
  // Reconnexion (veille du tel, reseau): on rejoint automatiquement avec le meme choix.
  if (st.wantJoin && st.team && st.character) doJoin();
});
socket.on('connect_error', (e) => console.warn('[play] serveur injoignable', e.message));
const st = { phase: 'lobby', teams: { A: [], B: [] }, characters: {}, team: null, character: null, joined: false, lastHp: null };
const input = { dx: 0, dy: 0, attack: false, defense: false, super: false };
const cds = { attack: 0, defense: 0, super: 0 };

try { $('#name').value = localStorage.getItem('sb_name') || ''; } catch (e) {}
try { const t = localStorage.getItem('sb_team'); if (t === 'A' || t === 'B') st.team = t; st.character = localStorage.getItem('sb_char'); } catch (e) {}

let fsDone = false;
document.addEventListener('pointerdown', () => {
  if (fsDone) return; fsDone = true;
  try { const p = document.documentElement.requestFullscreen?.(); p?.catch?.(() => {}); } catch (e) {}
}, { capture: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

function show(id) { for (const s of ['select', 'pad', 'end']) $('#' + s).hidden = s !== id; }

function taken(team, ch) {
  const others = (st.teams?.[team] || []).filter((p) => p.id !== socket.id);
  const used = new Set(others.map((p) => p.character));
  if (Object.keys(st.characters || {}).every((c) => used.has(c))) return false; // tous pris: doublons autorises
  return used.has(ch);
}

function renderSelect() {
  document.querySelectorAll('.team').forEach((b) => b.classList.toggle('on', b.dataset.team === st.team));
  const box = $('#chars'); box.innerHTML = '';
  if (st.character && !st.characters[st.character]) st.character = null;
  if (st.character && st.team && taken(st.team, st.character)) st.character = null;
  for (const [id, c] of Object.entries(st.characters || {})) {
    const b = document.createElement('button');
    b.className = 'char' + (id === st.character ? ' on' : '');
    b.disabled = !!(st.team && taken(st.team, id));
    const bn = document.createElement('b'); bn.textContent = c.name || id; b.appendChild(bn);
    const s = document.createElement('small'); s.textContent = `PV ${c.hp ?? '?'} · ${c.attack?.label || ''}`; b.appendChild(s);
    b.onclick = () => { st.character = id; renderSelect(); };
    box.appendChild(b);
  }
  $('#join').disabled = !(st.team && st.character);
}

document.querySelectorAll('.team').forEach((b) => (b.onclick = () => { st.team = b.dataset.team; renderSelect(); }));

function doJoin() {
  const name = ($('#name').value || '').trim().slice(0, 16);
  socket.emit(MSG.JOIN, { team: st.team, character: st.character, name }, (res) => {
    console.log('[play] JOIN ack', res);
    if (res && res.ok === false) { st.joined = false; st.wantJoin = false; $('#err').textContent = res.error || 'Impossible de rejoindre'; renderSelect(); show('select'); return; }
    st.joined = true; st.wantJoin = true; st.lastHp = null;
    setupPad(); if (st.phase !== 'ended') show('pad');
  });
}

$('#join').onclick = () => {
  try {
    const name = $('#name').value.trim().slice(0, 16);
    try { localStorage.setItem('sb_name', name); localStorage.setItem('sb_team', st.team); localStorage.setItem('sb_char', st.character); } catch (e) {}
    $('#err').textContent = '';
    st.joined = true; st.wantJoin = true; st.lastHp = null;
    setupPad(); show('pad');
    doJoin();
  } catch (e) {}
};

let stick = null;
let lastStickLog = 0;
function logStick() {
  const now = performance.now();
  if (now - lastStickLog > 250) { lastStickLog = now; console.log('[play] joystick dx dy', input.dx.toFixed(2), input.dy.toFixed(2)); }
}
function setupPad() {
  const ch = st.characters[st.character] || {};
  document.querySelectorAll('.btn').forEach((b) => {
    const k = b.dataset.k;
    b.querySelector('span').textContent = ch[k]?.label || { attack: 'Attaque', defense: 'Défense', super: 'Super' }[k];
  });
  document.body.style.setProperty('--team', st.team === 'A' ? 'var(--a)' : 'var(--b)');
  if (stick) return;
  try {
    stick = nipplejs.create({ zone: $('#stick'), mode: 'dynamic', color: 'white', size: 130 });
    // nipplejs v1: handler(evt) avec evt.data. v0.x: handler(evt, data). On gere les deux.
    stick.on('move', (evt, legacy) => {
      try {
        const d = legacy || evt?.data || {};
        const f = Math.min(1, Number(d.force) || 0);
        let x, y;
        if (d.vector && Number.isFinite(d.vector.x)) { x = d.vector.x; y = d.vector.y; }
        else { const a = d.angle?.radian ?? 0; x = Math.cos(a); y = Math.sin(a); }
        const m = Math.hypot(x, y) || 1;
        const k = Math.min(1, Math.max(f, m)) / m; // amplitude en [0,1]
        // Y nipplejs vers le haut, Y canvas vers le bas: on inverse.
        input.dx = Math.max(-1, Math.min(1, x * k));
        input.dy = Math.max(-1, Math.min(1, -y * k));
        logStick();
      } catch (e) {}
    });
    stick.on('end', () => { input.dx = 0; input.dy = 0; console.log('[play] joystick relache'); });
  } catch (e) {}
}

document.querySelectorAll('.btn').forEach((b) => {
  const k = b.dataset.k;
  const up = (e) => { input[k] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', (e) => {
    try { e.preventDefault(); b.setPointerCapture?.(e.pointerId); } catch (_) {}
    input[k] = true; b.classList.add('down');
    const now = performance.now();
    const cd = Number(st.characters[st.character]?.[k]?.cooldown) || 0;
    if (cd > 0 && now >= cds[k]) cds[k] = now + (cd > 50 ? cd : cd * 1000);
  });
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
});

function cdLoop() {
  try {
    const now = performance.now();
    document.querySelectorAll('.btn').forEach((b) => {
      const k = b.dataset.k;
      const cdRaw = Number(st.characters[st.character]?.[k]?.cooldown) || 0;
      const total = cdRaw > 50 ? cdRaw : cdRaw * 1000;
      const left = Math.max(0, cds[k] - now);
      b.querySelector('.cd').style.setProperty('--p', total ? left / total : 0);
      b.querySelector('em').textContent = left > 0 ? Math.ceil(left / 1000) : '';
    });
  } catch (e) {}
  requestAnimationFrame(cdLoop);
}
requestAnimationFrame(cdLoop);

setInterval(() => {
  if (!st.joined || st.phase === 'ended') return;
  try { socket.emit(MSG.INPUT, { ...input }); } catch (e) {}
}, 50);

socket.on(MSG.LOBBY, (d) => {
  console.log('[play] LOBBY', d.phase);
  try {
    const prev = st.phase;
    st.phase = d?.phase || 'lobby';
    st.teams = d?.teams || { A: [], B: [] };
    if (d?.characters) st.characters = d.characters;
    const inTeam = ['A', 'B'].some((t) => (st.teams[t] || []).some((p) => p.id === socket.id));
    if (st.phase === 'lobby' && prev === 'ended') { st.joined = false; }
    // Le serveur fait foi: si on est dans une equipe, on est en manette (y compris en cours de manche).
    if (inTeam && st.phase !== 'ended') { st.joined = true; st.wantJoin = true; setupPad(); show('pad'); }
    if (!st.joined) { renderSelect(); show('select'); } else renderSelect();
  } catch (e) {}
});

socket.on(MSG.STATE, (s) => {
  if (!stateLogged) { stateLogged = true; console.log('[play] premier STATE'); }
  try {
    if (!st.joined) return;
    const me = (s?.players || []).find((p) => p.id === socket.id);
    const sc = s?.score || {};
    $('#score .a').textContent = sc.A ?? 0; $('#score .b').textContent = sc.B ?? 0;
    const t = Math.max(0, Math.ceil(s?.timeLeft ?? 0));
    $('#timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    if (!me) return;
    $('#hp').textContent = `PV ${Math.max(0, Math.round(me.hp))}/${me.maxHp ?? '?'}`;
    if (st.lastHp != null && me.hp < st.lastHp) { try { navigator.vibrate?.(60); } catch (e) {} }
    st.lastHp = me.hp;
    const r = $('#respawn');
    if (me.alive === false) { r.hidden = false; r.textContent = `Respawn dans ${Math.max(0, Math.ceil(me.respawnIn ?? 0))}s`; }
    else r.hidden = true;
  } catch (e) {}
});

socket.on(MSG.END, (d) => {
  try {
    st.phase = 'ended';
    Object.assign(input, { dx: 0, dy: 0, attack: false, defense: false, super: false });
    const w = d?.winner;
    $('#endTitle').textContent = w === 'A' ? 'Victoire des Bleus' : w === 'B' ? 'Victoire des Rouges' : 'Égalité';
    $('#endScore').textContent = `Bleus ${d?.score?.A ?? 0} - ${d?.score?.B ?? 0} Rouges`;
    const m = d?.mvp;
    $('#endMvp').textContent = m ? `MVP : ${m.name || m.id || m}` : '';
    show('end');
  } catch (e) {}
});

socket.on('disconnect', () => { st.joined = false; /* wantJoin garde: re-JOIN auto a la reconnexion */ });
renderSelect();
