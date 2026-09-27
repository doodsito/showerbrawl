// Musique de fond de l'ecran hote en WebAudio. Lobby: boucle chiptune synthetisee.
// Combat: /sounds/music_circus.mp3 en boucle (AudioBuffer), repli sur la boucle chiptune tant qu'il n'est pas charge.
// Module autonome: son propre AudioContext, independant de sfx.js (sons d'action).
// Deux boucles chiptune: "lobby" (attente avant le combat) et "combat" (marche/hymne detourne, fight-night).

export const MUSIC_VOLUME = 0.4; // volume general de la musique (0..1), reglage de mixage
const FADE = 0.6;             // fondu entre les boucles (s)
const LOOKAHEAD = 0.12;       // fenetre de programmation (s)
const TICK_MS = 25;
const STORE_KEY = 'sb_music_muted';
const TRACK_URL = '/sounds/music_circus.mp3';
const TRACK_GAIN = 2.4;       // le MP3 sortait ~2,4x plus bas que la chiptune du lobby (0,029 vs 0,069): aligne le combat sur le lobby

// Notes -> frequence (A4 = 440)
const NOTE = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => {
  for (let o = 1; o <= 6; o++) NOTE[n + o] = 440 * Math.pow(2, (i - 9 + (o - 4) * 12) / 12);
});
const f = (n) => (n ? NOTE[n] : 0);

// Pistes: 1 caractere par double-croche. '.' = silence. Tableaux de notes: null = silence, '-' = tenue.
// Combat: re mineur, 150 BPM. Lead = debut d'hymne detourne en mineur facon marche arcade.
const COMBAT = {
  bpm: 150, steps: 64,
  bass: [
    'D2', null, 'D3', null, 'D2', null, 'D3', 'D2', 'D2', null, 'D3', null, 'D2', null, 'D3', 'C3',
    'A#1', null, 'A#2', null, 'A#1', null, 'A#2', 'A#1', 'C2', null, 'C3', null, 'C2', null, 'C3', 'C#3',
    'D2', null, 'D3', null, 'D2', null, 'D3', 'D2', 'F2', null, 'F3', null, 'F2', null, 'F3', 'E3',
    'G2', null, 'G3', null, 'A2', null, 'A3', null, 'A2', null, 'A2', 'A2', 'A2', null, 'C#3', null,
  ],
  lead: [
    'A4', '-', null, 'F4', 'D4', '-', 'F4', '-', 'A4', '-', 'D5', '-', '-', '-', null, null,
    'F5', '-', null, 'E5', 'D5', '-', 'F4', '-', 'G#4', '-', 'A4', '-', '-', '-', null, null,
    'A4', null, 'A4', null, 'F5', '-', 'E5', '-', 'D5', '-', 'C5', '-', 'A#4', '-', 'A4', '-',
    'G4', '-', 'A4', '-', 'A#4', '-', 'A#4', null, 'A4', '-', 'E4', 'F4', 'G4', '-', 'C#5', '-',
  ],
  kick:  'x...x...x...x...x...x...x...x...x...x...x...x...x...x...x.x.x.x.',
  snare: '....x.......x.......x.......x.......x.......x.......x.....x.xxxx',
  hat:   'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
  leadWave: 'square', leadGain: 0.34, bassWave: 'sawtooth', bassGain: 0.42, hatGain: 0.16,
};
// Lobby: meme tonalite, 96 BPM, pose. Basse longue + arpege triangle + hats doux.
const LOBBY = {
  bpm: 96, steps: 64,
  bass: [
    'D2', '-', '-', '-', '-', '-', '-', '-', 'D2', '-', '-', '-', 'A1', '-', '-', '-',
    'A#1', '-', '-', '-', '-', '-', '-', '-', 'A#1', '-', '-', '-', 'C2', '-', '-', '-',
    'D2', '-', '-', '-', '-', '-', '-', '-', 'F2', '-', '-', '-', 'E2', '-', '-', '-',
    'G2', '-', '-', '-', '-', '-', '-', '-', 'A1', '-', '-', '-', '-', '-', '-', '-',
  ],
  lead: [
    'D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'D4', 'F4', 'D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'A4', 'C5',
    'A#3', 'D4', 'F4', 'A#4', 'F4', 'D4', 'A#3', 'D4', 'C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'G4', 'A4',
    'D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'D4', 'F4', 'F4', 'A4', 'C5', 'F5', 'E4', 'G4', 'A#4', 'C#5',
    'G3', 'A#3', 'D4', 'G4', 'D4', 'A#3', 'G3', 'A#3', 'A3', 'C#4', 'E4', 'A4', 'E4', 'C#4', 'A3', 'E4',
  ],
  kick:  'x...............x...............x...............x.......x.......',
  snare: '................................................................',
  hat:   '..x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x.',
  leadWave: 'triangle', leadGain: 0.3, bassWave: 'triangle', bassGain: 0.5, hatGain: 0.08,
};
const SONGS = { combat: COMBAT, lobby: LOBBY };

let ctx = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem(STORE_KEY) === '1'; } catch (e) {}
let wanted = null;            // boucle demandee par la phase ('lobby' | 'combat')
let current = null;           // { name, bus, step, next }
let timer = null;
let track = null, trackState = 'idle'; // AudioBuffer du combat: 'idle' | 'loading' | 'ready' | 'failed'

// Chargement en arriere-plan (apres le premier geste). Echec => on garde la boucle synthetisee.
function loadTrack() {
  if (trackState !== 'idle' || !ctx) return;
  trackState = 'loading';
  fetch(TRACK_URL)
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then((b) => new Promise((ok, ko) => { const p = ctx.decodeAudioData(b, ok, ko); if (p && p.catch) p.catch(ko); }))
    .then((buf) => {
      track = buf; trackState = 'ready';
      console.log('[music] combat track loaded', buf.duration.toFixed(1) + 's');
      if (wanted === 'combat') switchTo('combat');
    })
    .catch((e) => { trackState = 'failed'; console.warn('[music] combat track failed, keeping chiptune', e && e.message); });
}
// Nom effectif de la boucle: le combat passe sur le MP3 des qu'il est pret.
const resolve = (name) => (name === 'combat' && track ? 'combatTrack' : name);

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MUSIC_VOLUME;
  master.connect(ctx.destination);
  // Buffer de bruit blanc pour caisse claire / charleston.
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function tone(bus, t, freq, dur, wave, gain) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.setValueAtTime(gain, t + Math.max(0.01, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function kick(bus, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(bus); o.start(t); o.stop(t + 0.18);
}
function noise(bus, t, dur, type, freq, gain) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.value = freq;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
}

// Duree d'une note tenue: compte les '-' qui suivent.
function held(track, i, stepDur) {
  let n = 1;
  while (track[(i + n) % track.length] === '-' && n < track.length) n++;
  return n * stepDur;
}

function scheduleStep(song, bus, i, t) {
  const sd = 60 / song.bpm / 4;
  const b = song.bass[i], l = song.lead[i];
  if (b && b !== '-') tone(bus, t, f(b), held(song.bass, i, sd) * 0.95, song.bassWave, song.bassGain);
  if (l && l !== '-') {
    const d = held(song.lead, i, sd) * 0.9;
    tone(bus, t, f(l), d, song.leadWave, song.leadGain);
    if (song === COMBAT) tone(bus, t, f(l) * 1.005, d, 'square', song.leadGain * 0.35); // leger chorus
  }
  if (song.kick[i] === 'x') kick(bus, t);
  if (song.snare[i] === 'x') noise(bus, t, 0.14, 'bandpass', 1800, 0.5);
  if (song.hat[i] === 'x') noise(bus, t, 0.035, 'highpass', 7000, song.hatGain);
}

function tick() {
  if (!ctx || !current || current.src) return;
  const song = SONGS[current.name];
  const sd = 60 / song.bpm / 4;
  while (current.next < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(song, current.bus, current.step, current.next);
    current.step = (current.step + 1) % song.steps;
    current.next += sd;
  }
}

// Bascule avec fondu: l'ancienne boucle s'eteint, la nouvelle monte.
function switchTo(name) {
  if (!ctx || ctx.state !== 'running') return;
  name = resolve(name);
  if (current && current.name === name) return;
  const now = ctx.currentTime;
  if (current) {
    const old = current.bus;
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + FADE);
    const oldSrc = current.src;
    if (oldSrc) try { oldSrc.stop(now + FADE + 0.05); } catch (e) {}
    setTimeout(() => { try { old.disconnect(); } catch (e) {} }, (FADE + 1) * 1000);
  }
  if (!name) { current = null; return; }
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1, now + FADE);
  bus.connect(master);
  current = { name, bus, step: 0, next: now + 0.05 };
  if (name === 'combatTrack') {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = track; src.loop = true; g.gain.value = TRACK_GAIN;
    src.connect(g).connect(bus); src.start(now + 0.02);
    current.src = src;
  }
  console.log('[music] playing', name);
  if (!timer) timer = setInterval(tick, TICK_MS);
}

export const Music = {
  // Appele a chaque changement de phase: 'playing' => combat, sinon lobby.
  setPhase(phase) {
    wanted = phase === 'playing' ? 'combat' : 'lobby';
    switchTo(wanted);
  },
  // Premiere interaction utilisateur (autoplay policy). Safari: resume explicite dans le geste.
  unlock() {
    try {
      if (!ensureCtx()) return;
      const go = () => { loadTrack(); if (wanted) switchTo(wanted); };
      if (ctx.state !== 'running') {
        // Safari exige un son joue pendant le geste: buffer muet d'un echantillon.
        const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
        const p = ctx.resume(); if (p && p.then) p.then(go, () => {}); else go();
      } else go();
    } catch (e) {}
  },
  isMuted() { return muted; },
  toggleMute() {
    muted = !muted;
    try { localStorage.setItem(STORE_KEY, muted ? '1' : '0'); } catch (e) {}
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(muted ? 0 : MUSIC_VOLUME, now + 0.2);
    }
    console.log('[music] muted', muted);
    return muted;
  },
  // Pour les tests / debug.
  state() { return { volume: master ? master.gain.value : null, ctx: ctx ? ctx.state : 'none', playing: current ? current.name : null, muted, track: trackState }; },
};
