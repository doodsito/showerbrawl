import {assetUrl, watchVersion} from '../version.js';
import nipplejs from 'nipplejs';
import { io } from 'socket.io-client';
import { MSG } from '../../shared/protocol.js';
import { createView } from './view.js';
import { preloadCombatArt } from '../combat-assets.js';

const $ = (s) => document.querySelector(s);
// Reconnexion sans recharger: websocket d'abord, tentatives illimitees, 500 ms a 3 s.
const socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 500, reconnectionDelayMax: 3000 });
// Identifiant persistant du joueur: genere une seule fois, envoye a chaque JOIN (reprise du perso apres rechargement/veille).
const playerKey = (() => {
  const gen = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
  try { let k = localStorage.getItem('sb_key'); if (!k) { k = gen(); localStorage.setItem('sb_key', k); } return k; } catch (e) { return gen(); }
})();
const setJoined = (on) => { try { on ? localStorage.setItem('sb_joined', '1') : localStorage.removeItem('sb_joined'); } catch (e) {} };
let stateLogged = false;
// Bandeau discret pendant une coupure, retire des que le JOIN de reprise est accepte.
const banner = document.createElement('div');
banner.id = 'reconnecting'; banner.textContent = 'Reconnecting...'; banner.hidden = true;
banner.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9999;padding:3px 12px;font:700 12px/1.4 monospace;letter-spacing:.1em;color:#fff;background:#000b;border:1px solid #fff3;border-top:0;border-radius:0 0 6px 6px;pointer-events:none';
document.body.appendChild(banner);
const setBanner = (on) => { banner.hidden = !on; };
socket.on('disconnect', () => { if (st.wantJoin) setBanner(true); });

// Ecran allume (Screen Wake Lock): des l'ecran de selection, pendant lobby et match, redemande au retour de visibilite.
let wakeLock = null;
async function keepAwake() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || (wakeLock && !wakeLock.released)) return;
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) { /* non supporte ou refuse: ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
document.addEventListener('pointerdown', keepAwake, { passive: true }); // certains navigateurs exigent un geste
keepAwake();

socket.on('connect', () => {
  console.log('[play] socket connecte', socket.id);
  if (!st.wantJoin) setBanner(false);
  // Reconnexion (veille du tel, reseau): on rejoint automatiquement avec le meme choix.
  if (st.wantJoin && st.character && !st.returning) doJoin();
});
socket.on('kicked', () => { st.joined = false; st.wantJoin = false; setJoined(false); $('#err').textContent = 'Removed by the host'; renderSelect(); show('select'); });
socket.on('connect_error', (e) => {
  console.warn('[play] serveur injoignable', e.message);
  // Refus cote serveur (socket.active false): socket.io ne retente plus seul, on relance nous-memes.
  if (!socket.active) setTimeout(() => { if (!socket.connected) socket.connect(); }, 1000);
});
const st = { phase: 'lobby', teams: { A: [], B: [] }, characters: {}, team: null, character: null, joined: false, lastHp: null, energy: 0, alive: false };
const input = { dx: 0, dy: 0, attack: false, defense: false, super: false };
const cds = { attack: 0, defense: 0, super: 0 };

try { $('#name').value = localStorage.getItem('sb_name') || ''; } catch (e) {}
try { st.character = localStorage.getItem('sb_char'); } catch (e) {}

// A release refresh restores the same player choice on the new connection.
try { st.wantJoin = sessionStorage.getItem('sb_release_rejoin') === '1'; sessionStorage.removeItem('sb_release_rejoin'); } catch {}
// Rechargement de page en cours de partie: on reprend son perso (le serveur le garde 5 s via playerKey).
try { if (localStorage.getItem('sb_joined') === '1' && st.character) st.wantJoin = true; } catch (e) {}
const checkVersion = watchVersion({
  canReload: () => !!st.arena && st.phase === 'lobby',
  beforeReload: () => { try { if (st.wantJoin) sessionStorage.setItem('sb_release_rejoin', '1'); } catch {} },
});

let fsDone = false;
document.addEventListener('pointerdown', () => {
  if (fsDone) return; fsDone = true;
  try { const p = document.documentElement.requestFullscreen?.(); p?.catch?.(() => {}); } catch (e) {}
}, { capture: true });
// Anti-zoom iOS (Safari ignore user-scalable=no): pincement, double-tap, dblclick.
const noZoom = (e) => e.preventDefault();
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, noZoom, { passive: false });
const isCtl = (t) => !!(t && t.closest && t.closest('#stick, .btns, .btn, #view, #pad'));
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 && !isCtl(e.target)) e.preventDefault();
}, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !isCtl(e.target) && e.target.id !== 'name') e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
$('#name').addEventListener('blur', () => { window.scrollTo(0, 0); });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function show(id) { for (const s of ['select', 'pad', 'end']) $('#' + s).hidden = s !== id; }

// Un perso = un seul joueur, toutes equipes confondues, sans exception. Renvoie le joueur qui le tient.
function taken(ch) {
  return ['A', 'B'].flatMap((t) => st.teams?.[t] || []).find((p) => p.id !== socket.id && p.character === ch) || null;
}

function renderSelect() {
  const box = $('#chars'); box.innerHTML = '';
  if (st.character && Object.keys(st.characters).length && !st.characters[st.character]) st.character = null;
  if (st.character && taken(st.character) && !taken(st.character).offline) st.character = null;
  for (const [id, c] of Object.entries(st.characters || {})) {
    const b = document.createElement('button');
    b.className = 'char' + (id === st.character ? ' on' : '');
    const holder = taken(id);
    b.disabled = !!holder && !holder.offline; // fantome: cliquable, le serveur tranche (reprise ou refus avec le pseudo)
    if (holder) b.classList.add('taken');
    if(/\.png$/i.test(c.sprite||'')){const img=document.createElement('img');img.src=assetUrl(c.sprite);img.alt='';img.className='portrait';img.onerror=()=>{img.hidden=true;};b.appendChild(img);}
    const bn = document.createElement('b'); bn.textContent = c.name || id; b.appendChild(bn);
    const s = document.createElement('small'); s.textContent = holder ? `by ${holder.name}${holder.offline ? ' (offline)' : ''}` : `HP ${c.hp ?? '?'}`; b.appendChild(s);
    if (holder) { const tg = document.createElement('span'); tg.className = 'taken-tag'; tg.textContent = 'TAKEN'; b.appendChild(tg); }
    b.onclick = () => { st.character = id; renderSelect(); };
    box.appendChild(b);
  }
  $('#join').disabled = !st.character;
}

let joinAttempt = 0;
function doJoin() {
  const attempt = ++joinAttempt;
  const name = ($('#name').value || '').trim().slice(0, 16);
  socket.emit(MSG.JOIN, { character: st.character, name, playerKey }, (res) => {
    if (attempt !== joinAttempt || st.returning) return;
    console.log('[play] JOIN ack', res);
    if (res && res.repick) { st.character = null; try { localStorage.removeItem('sb_char'); } catch (e) {} }
    if (res && res.ok === false) {
      st.joined = false; st.wantJoin = false; setJoined(false); setBanner(false);
      $('#err').textContent = res.takenBy ? `Character already taken by ${res.takenBy}${res.takenOffline ? ' (disconnected, freed in 5 s)' : ''}` : (res.error || 'Could not join');
      renderSelect(); show('select'); return;
    }
    setJoined(true); setBanner(false);
    st.joined = true; st.wantJoin = true; st.lastHp = null;
    setupPad(); if (st.phase !== 'ended') show('pad');
  });
}

$('#join').onclick = () => {
  try {
    const name = $('#name').value.trim().slice(0, 16);
    try { localStorage.setItem('sb_name', name); localStorage.setItem('sb_char', st.character); } catch (e) {}
    $('#err').textContent = '';
    st.joined = true; st.wantJoin = true; st.lastHp = null;
    setupPad(); show('pad');
    doJoin();
  } catch (e) {}
};

// Le serveur confirme la liberation avant de permettre un nouveau choix.
function backToSelect() {
  if (st.returning || !socket.connected || st.phase === 'playing') return;
  clearInput();
  st.returning = true; ++joinAttempt;
  socket.timeout(4000).emit('leave', (error, res) => {
    st.returning = false;
    if (error || !res?.ok) {
      // Ack perdu : reprendre la session avant une nouvelle tentative de retour.
      if (error && socket.connected && st.wantJoin) doJoin();
      return;
    }
    st.joined = false; st.wantJoin = false; st.alive = false;
    st.lastHp = null; st.wasAlive = false; st.energy = 0;
    setJoined(false); setBanner(false);
    try { sessionStorage.removeItem('sb_release_rejoin'); } catch {}
    for (const k of Object.keys(cds)) cds[k] = 0;
    $('#respawn').hidden = true; $('#err').textContent = '';
    stick?.destroy(); stick = null;
    renderSelect(); show('select'); syncView();
  });
}
document.querySelectorAll('.back-select').forEach(b => b.addEventListener('click', backToSelect));

let stick = null;
let lastStickLog = 0;
function logStick() {
  const now = performance.now();
  if (now - lastStickLog > 250) { lastStickLog = now; console.log('[play] joystick dx dy', input.dx.toFixed(2), input.dy.toFixed(2)); }
}
// Equipe assignee par le serveur (tirage au sort): couleur et libelle mis a jour en direct.
function applyTeam() {
  document.body.style.setProperty('--team', st.team === 'A' ? 'var(--a)' : st.team === 'B' ? 'var(--b)' : 'var(--gold)');
  document.body.dataset.team = st.team || '';
  $('#meTeam').textContent = st.team === 'A' ? 'CONSPIRACY CREW' : st.team === 'B' ? 'CANCEL CLUB' : 'TEAM';
}
function setupPad() {
  const ch = st.characters[st.character] || {};
  document.querySelectorAll('.btn').forEach((b) => {
    const k = b.dataset.k;
    const icon=b.querySelector('img');icon.hidden=!ch[k]?.icon;if(ch[k]?.icon)icon.src=assetUrl(ch[k].icon);
    b.title=k==='super'&&ch[k]?.charge?'Charges as you deal and take damage':ch[k]?.label||k;
    b.querySelector('span').textContent = { attack: 'ATTACK', defense: 'DEFENSE', super: 'SUPER' }[k];
  });
  $('#kit-hint').textContent=ch.super?.charge?'Super charges in combat · Dodge: joystick + button':'Hold a direction and use your abilities';
  if(ch.hint)$('#kit-hint').textContent=ch.hint; // texte d'aide propre au perso (champ hint de characters.json)
  applyTeam();
  const nm = ($('#name').value || '').trim() || 'PLAYER', img = $('#meImg');
  $('#meName').textContent = nm; $('#meChar').textContent = ch.name || st.character || '--';
  $('#meInit').textContent = (ch.name || st.character || '?')[0].toUpperCase();
  $('#heroName').textContent = ch.name || st.character || '--'; $('#heroInit').textContent = $('#meInit').textContent;
  const hi = $('#heroImg'); hi.hidden = !/\.png$/i.test(ch.sprite || ''); if (!hi.hidden) { hi.src = assetUrl(ch.sprite); hi.onerror = () => { hi.hidden = true; }; }
  img.hidden = !/\.png$/i.test(ch.sprite || ''); if (!img.hidden) { img.src = assetUrl(ch.sprite); img.onerror = () => { img.hidden = true; }; }
  if (stick) return;
  try {
    // Mode static: dessin fixe en bas a gauche, en miroir exact du bouton ATTACK (taille et marges CSS).
    const cs = getComputedStyle(document.documentElement), padBtn = parseFloat(cs.getPropertyValue('--pad-btn')) || 88;
    const at = `calc(var(--pad-m) + ${padBtn / 2}px + `;
    stick = nipplejs.create({ zone: $('#stick'), mode: 'static', size: padBtn, restOpacity: 1,
      position: { left: at + 'var(--sl))', bottom: at + 'var(--sb))' },
      color: { front: 'radial-gradient(circle at 40% 32%, #ffffff 0%, #d7dee8 40%, #9aa7b8 100%)', back: 'radial-gradient(circle, #243756 0%, #1b2942 70%)' } });
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
        pushInput();
      } catch (e) {}
    });
    stick.on('end', () => { input.dx = 0; input.dy = 0; pushInput(); console.log('[play] joystick relache'); });
  } catch (e) {}
}

document.querySelectorAll('.btn').forEach((b) => {
  const k = b.dataset.k;
  const up = () => { input[k] = false; b.classList.remove('down'); sendInput(); };
  b.addEventListener('pointerdown', (e) => {
    try { e.preventDefault(); b.setPointerCapture?.(e.pointerId); } catch (_) {}
    input[k] = true; b.classList.add('down');
    sendInput();
  });
  b.addEventListener('click',e=>{if(e.detail===0&&!b.disabled){input[k]=true;sendInput();up();}});
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
});

function cdLoop() {
  try {
    const now = performance.now();
    document.querySelectorAll('.back-select').forEach(b => {
      b.hidden = st.phase === 'playing';
      b.disabled = !!st.returning || !socket.connected || st.phase === 'playing';
    });
    document.querySelectorAll('.btn').forEach((b) => {
      const k = b.dataset.k;
      const cdRaw = Number(st.characters[st.character]?.[k]?.cooldown) || 0;
      const total = cdRaw > 50 ? cdRaw : cdRaw * 1000;
      const left = Math.max(0, cds[k] - now),charged=k==='super'&&st.characters[st.character]?.super?.charge;
      b.querySelector('.cd').style.setProperty('--p', charged&&st.energy<100?1-st.energy/100:total ? left / total : 0);
      b.querySelector('em').textContent = charged&&st.energy<100?`${Math.floor(st.energy)}%`:left > 0 ? `${Math.ceil(left / 1000)}s` : charged?'READY':'';
      b.disabled=!st.joined||st.phase!=='playing'||!st.alive;
      b.classList.toggle('cool',left>0||(!!charged&&st.energy<100));
      b.classList.toggle('ready',!!charged&&st.energy>=100&&left===0);
    });
  } catch (e) {}
    try {
    const ph = st.phase, alive = st.alive, bd = document.body.dataset;
    bd.phase = ph; bd.alive = alive ? '1' : '0';
    $('#meStatus').textContent = !socket.connected ? 'OFFLINE' : ph === 'playing' ? (alive ? 'IN MATCH' : 'KNOCKED OUT') : ph === 'ended' ? 'OVER' : 'READY';
    $('#wait').hidden = ph === 'playing';
  } catch (e) {}
  requestAnimationFrame(cdLoop);
}
requestAnimationFrame(cdLoop);

let lastSend=0,pendingSend=null;
function sendInput(){lastSend=performance.now();if(st.joined&&!st.returning&&socket.connected)socket.emit(MSG.INPUT,{...input});}
// Envoi immediat a chaque mouvement du joystick, throttle a 30 ms (le setInterval reste en filet de securite).
function pushInput(){
  const wait=30-(performance.now()-lastSend);
  if(wait<=0){clearTimeout(pendingSend);pendingSend=null;sendInput();}
  else if(!pendingSend)pendingSend=setTimeout(()=>{pendingSend=null;sendInput();},wait);
}
function clearInput(){Object.assign(input,{dx:0,dy:0,attack:false,defense:false,super:false});document.querySelectorAll('.down').forEach(b=>b.classList.remove('down'));sendInput();}
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
setInterval(sendInput,100); // filet de securite, l'envoi principal est immediat

// Vue de jeu sur le telephone (camera fixe sur l'octogone) ou manette seule, choix memorise.
let viewEnabled = true;
// Bascule Game view / Controller only masquee dans cette version: vue toujours active.
const SHOW_FPS = new URLSearchParams(location.search).get('fps') === '1';
if (SHOW_FPS) $('#fps').hidden = false;
const view = createView($('#view'), { getArena: () => st.arena, getCharacters: () => st.characters, myId: () => socket.id, fpsEl: SHOW_FPS ? $('#fps') : null });
function syncView() {
  const on = viewEnabled && st.joined && st.phase === 'playing' && !$('#pad').hidden;
  view.setActive(on);
  document.body.classList.toggle('viewing', on);
  $('#viewToggle').textContent = viewEnabled ? 'Controller only' : 'Game view';
}
$('#viewToggle').addEventListener('click', (e) => {
  e.stopPropagation(); viewEnabled = !viewEnabled;
  try { localStorage.setItem('sb_view', viewEnabled ? 'on' : 'off'); } catch (err) {}
  syncView();
});
socket.on(MSG.VIEW, (v) => { try { view.push(v); } catch (e) {} });
window.showerBrawlView = view; // debug / tests: position de la camera
// Sans ecran hote: le premier joueur inscrit lance la manche depuis sa manette (meme MSG.START).
$('#startMatch').addEventListener('click', (e) => { e.stopPropagation(); socket.emit(MSG.START); });
setInterval(syncView, 500);

socket.on(MSG.LOBBY, (d) => {
  console.log('[play] LOBBY', d.phase);
  try {
    const prev = st.phase;
    st.phase = d?.phase || 'lobby';
    checkVersion();
    if(st.phase!=='playing'){clearInput();st.energy=0;st.alive=false;for(const k of Object.keys(cds))cds[k]=0;}
    st.teams = d?.teams || { A: [], B: [] };
    if (d?.characters) { st.characters = d.characters; preloadCombatArt(st.characters); }
    if (d?.arena) st.arena = d.arena;
    $('#startMatch').hidden = !(st.phase === 'lobby' && d?.hasHost === false && d?.firstPlayer === socket.id);
    const myTeam = ['A', 'B'].find((t) => (st.teams[t] || []).some((p) => p.id === socket.id));
    const inTeam = !!myTeam;
    if (myTeam !== st.team) { st.team = myTeam || null; applyTeam(); }
    if (st.phase === 'lobby' && prev === 'ended') { st.joined = false; }
    // Perso retire du jeu (deploiement): retour propre au choix de perso.
    if (!inTeam && st.character && Object.keys(st.characters).length && !st.characters[st.character]) {
      if (st.joined || st.wantJoin) $('#err').textContent = 'Your character left the game, pick another one';
      st.joined = false; st.wantJoin = false; st.character = null; setJoined(false);
      try { localStorage.removeItem('sb_char'); } catch (e) {}
    }
    // Le serveur fait foi: si on est dans une equipe, on est en manette (y compris en cours de manche).
    if (inTeam && !st.returning && st.phase !== 'ended') { st.joined = true; st.wantJoin = true; setupPad(); show('pad'); }
    // Reprise en cours (wantJoin): on reste sur la manette, pas de retour a la selection.
    if (!st.joined && !st.wantJoin) { renderSelect(); show('select'); } else renderSelect();
    syncView();
  } catch (e) {}
});

// Retour de coup: vibration Android, switch haptique iOS 18, vignette rouge + tremblement partout.
let vibOn = true, lastBuzz = 0, hitTimer = null;
try { vibOn = localStorage.getItem('sb_vib') !== '0'; } catch (e) {}
const vibBtn = $('#vib');
const renderVib = () => { vibBtn.classList.toggle('off', !vibOn); vibBtn.setAttribute('aria-pressed', String(vibOn)); };
renderVib();
// Bascule sur pointerup (le click peut etre perdu par le passage plein ecran au premier toucher).
let vibT = 0;
const toggleVib = (e) => { e.preventDefault(); e.stopPropagation(); const now = performance.now(); if (now - vibT < 300) return; vibT = now; vibOn = !vibOn; renderVib(); try { localStorage.setItem('sb_vib', vibOn ? '1' : '0'); } catch (e) {} if (vibOn) buzz(40); };
vibBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
vibBtn.addEventListener('pointerup', toggleVib);
vibBtn.addEventListener('click', (e) => { if (e.detail === 0) toggleVib(e); else e.preventDefault(); });
const canVibrate = typeof navigator.vibrate === 'function';
const hap = $('#hap'), hapLbl = $('#hapLbl');
// iOS 18: basculer un <input switch> via son label declenche un tic haptique. Safari peut l'ignorer hors geste:
// on tente une fois, et si le switch n'est pas pris en charge ou si la bascule echoue, on abandonne sans bruit.
let hapOk = !canVibrate && hap && 'switch' in hap;
function buzz(pattern) {
  if (!vibOn) return;
  try {
    if (canVibrate) { navigator.vibrate(pattern); return; }
    if (hapOk) { const before = hap.checked; hapLbl.click(); if (hap.checked === before) hapOk = false; }
  } catch (e) { hapOk = false; }
}
function hitFeedback(dmg, dead) {
  const now = performance.now();
  if (dead || now - lastBuzz >= 120) { lastBuzz = now; buzz(dead ? [100, 60, 200] : dmg > 15 ? 90 : 40); }
  const h = $('#hit'), pad = $('#pad');
  h.classList.remove('on', 'dead'); pad.classList.remove('shake'); void h.offsetWidth;
  h.classList.add(dead ? 'dead' : 'on'); pad.classList.add('shake');
  clearTimeout(hitTimer); hitTimer = setTimeout(() => { h.classList.remove('on', 'dead'); pad.classList.remove('shake'); }, dead ? 450 : 150);
}

// Etat perso leger envoye par le serveur a ce seul socket (le STATE complet ne va qu'a l'ecran hote).
socket.on(MSG.ME, (me) => {
  if (!stateLogged) { stateLogged = true; console.log('[play] premier ME'); }
  try {
    if (!st.joined || !me) return;
    const sc = me.score || {};
    $('#score .a').textContent = sc.A ?? 0; $('#score .b').textContent = sc.B ?? 0;
    const t = Math.max(0, Math.ceil(me.timeLeft ?? 0));
    $('#timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    st.alive=me.alive;st.energy=me.energy||0;
    for(const k of Object.keys(cds))cds[k]=performance.now()+Math.max(0,me.cd?.[k]||0)*1000;
    $('#hp').textContent = `HP ${Math.max(0, Math.round(me.hp))}/${me.maxHp ?? '?'}`;
    if (st.lastHp != null && me.hp < st.lastHp && me.alive !== false) hitFeedback(st.lastHp - me.hp, false);
    if (st.wasAlive === true && me.alive === false) hitFeedback(0, true);
    st.wasAlive = me.alive; st.lastHp = me.hp;
    const r = $('#respawn');
    if (me.alive === false) { r.hidden = false; r.innerHTML = `<b>KNOCKED OUT</b><span>RESPAWN IN ${Math.max(0, Math.ceil(me.respawnIn ?? 0))}S</span>`; }
    else r.hidden = true;
  } catch (e) {}
});

socket.on(MSG.END, (d) => {
  if (!st.joined) return;
  try {
    st.phase = 'ended';
    Object.assign(input, { dx: 0, dy: 0, attack: false, defense: false, super: false });
    const w = d?.winner;
    $('#endTitle').textContent = w === 'A' ? 'Blue team wins' : w === 'B' ? 'Red team wins' : 'Draw';
    $('#endScore').textContent = `Blue ${d?.score?.A ?? 0} - ${d?.score?.B ?? 0} Red`;
    const m = d?.mvp;
    $('#endMvp').textContent = m ? `MVP: ${m.name || m.id || m}` : '';
    const gg = $('#endGag'); gg.hidden = true; clearTimeout(st.gagT); st.gagT = setTimeout(() => { gg.hidden = false; }, 3200); // gag hote
    show('end');
  } catch (e) {}
});

socket.on('disconnect', () => { clearInput();st.joined = false;st.alive=false; /* wantJoin garde: re-JOIN auto a la reconnexion */ });
renderSelect();

// iPhone dans Safari (pas en mode app): bandeau unique pour installer sur l'ecran d'accueil.
try {
  const ios = /iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && /Mobile/.test(navigator.userAgent));
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  let seen = false; try { seen = localStorage.getItem('sb_a2hs') === '1'; } catch (e) {}
  if (ios && !standalone && !seen) {
    const bar = $('#a2hs'); bar.hidden = false;
    const close = (e) => { e.preventDefault(); e.stopPropagation(); bar.hidden = true; try { localStorage.setItem('sb_a2hs', '1'); } catch (err) {} };
    $('#a2hsClose').addEventListener('pointerup', close);
    $('#a2hsClose').addEventListener('click', close);
  }
} catch (e) {}
