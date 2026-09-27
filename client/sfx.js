// Sons d'action de l'ecran hote en WebAudio: synthetises + fichiers MP3 de client/public/sounds/.
// Fichiers: <perso>_<slot>.mp3 (attack/defense/super) et fx_<nom>.mp3, precharges en AudioBuffer au premier geste.
// Un fichier absent (404) est ignore: le son synthetise prend le relais.
const SLOTS = ['attack', 'defense', 'super'];
const FX = ['victory', 'defeat'];
const VOICE_VOLUME = 0.8;
const MAX_VOICES = 4;
// Volume par fichier (gain de lecture 0..1, sans reencoder le MP3). Absent = 1. Cle = nom du fichier sans .mp3.
// Son trop fort: ajouter une ligne `nom_du_fichier: 0.5`.
export const VOLUME = {
  musk_attack: 0.22, // lance-flammes: souffle large bande de 0,9 s, domine a 0,4 (-45 %)
};
export const SFX = {
  ctx: null, master: null, out: null, voice: null, muted: false,
  buffers: new Map(), wanted: new Set(FX.map((n) => `fx_${n}`)), loading: new Set(), playing: new Map(),
  init() {
    try {
      if (this.ctx) { if (this.ctx.state !== 'running') this._resume(); this._preload(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.muted ? 0 : 1;
      this.out.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.out);
      this.voice = this.ctx.createGain();
      this.voice.gain.value = VOICE_VOLUME;
      this.voice.connect(this.out);
      this._resume();
      this._preload();
    } catch (e) {}
  },
  // Safari: un son joue pendant le geste + resume explicite.
  _resume() {
    try {
      const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050); s.connect(this.ctx.destination); s.start(0);
      const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  },
  // Declare les persos connus (cles de characters.json): leurs 3 fichiers seront tentes au chargement.
  setCharacters(keys) {
    for (const k of keys || []) for (const slot of SLOTS) this.wanted.add(`${String(k).toLowerCase()}_${slot}`);
    this._preload();
  },
  _preload() {
    if (!this.ctx) return;
    for (const name of this.wanted) {
      if (this.loading.has(name)) continue;
      this.loading.add(name);
      fetch(`/sounds/${name}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((ab) => ab && new Promise((ok, ko) => { const p = this.ctx.decodeAudioData(ab, ok, ko); if (p && p.then) p.then(ok, ko); }))
        .then((buf) => { if (buf) this.buffers.set(name, buf); })
        .catch(() => {});
    }
  },
  has(name) { return this.buffers.has(name); },
  setMuted(m) {
    this.muted = !!m;
    try {
      if (!this.out) return;
      const now = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + 0.1);
    } catch (e) {}
  },
  // Joue un fichier precharge. key: anti-spam (meme son du meme joueur pas avant la fin du precedent). false si indisponible.
  // Le gain de lecture vient de VOLUME[name] (1 par defaut).
  play(name, key = name) {
    try {
      const buf = this.buffers.get(name);
      if (!buf || !this.ctx) return false;
      if (this.playing.has(key)) return true;
      if (this.playing.size >= MAX_VOICES) return true;
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const vol = VOLUME[name] ?? 1;
      if (vol !== 1) { const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.voice); }
      else s.connect(this.voice);
      this.playing.set(key, s);
      s.onended = () => { if (this.playing.get(key) === s) this.playing.delete(key); };
      s.start();
      console.log('[sfx] fichier joue', `${name}.mp3`, 'x', vol);
      return true;
    } catch (e) { return false; }
  },
  // Pouvoir lance: fichier <perso>_<slot>.mp3 si present, sinon son synthetise.
  cast(playerId, character, slot) {
    const name = `${String(character || '').toLowerCase()}_${slot}`;
    if (character && this.play(name, `${playerId}:${name}`)) return;
    console.log('[sfx] synth', name);
    this.shoot();
  },
  // Fin de manche: victoire si une equipe gagne, defaite sur egalite.
  end(draw) {
    const name = draw ? 'fx_defeat' : 'fx_victory';
    if (!this.play(name)) this.win();
  },
  _tone(type, f0, f1, dur, vol = 1, delay = 0) {
    try {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur);
    } catch (e) {}
  },
  _noise(dur, vol = 1, delay = 0) {
    try {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      s.connect(g); g.connect(this.master); s.start(t0);
    } catch (e) {}
  },
  shoot() { this._tone('square', 880, 220, 0.12, 0.25); },
  // vol: multiplicateur (1 = coup normal, 0.3 = bip attenue du lance-flammes).
  hit(vol = 1) { this._noise(0.1, 0.4 * vol); this._tone('sawtooth', 300, 80, 0.1, 0.2 * vol); },
  death() { this._tone('triangle', 500, 60, 0.6, 0.5); this._noise(0.3, 0.3, 0.05); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this._tone('square', f, f, 0.18, 0.3, i * 0.15)); },
};
