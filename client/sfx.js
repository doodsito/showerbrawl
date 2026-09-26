// Sons synthétisés en WebAudio, aucun fichier audio.
export const SFX = {
  ctx: null, master: null,
  init() {
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) {}
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
  hit() { this._noise(0.1, 0.4); this._tone('sawtooth', 300, 80, 0.1, 0.2); },
  death() { this._tone('triangle', 500, 60, 0.6, 0.5); this._noise(0.3, 0.3, 0.05); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this._tone('square', f, f, 0.18, 0.3, i * 0.15)); },
};
