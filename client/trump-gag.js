// Gag de fin de match (ecran hote, pur visuel): 2,5 s de vraie victoire, glitch, tampon RIGGED!, puis Trump + banniere.
// Assets optionnels (repli dessine en code si absents): sprites/trump_win_pose.png, trump_win_banner.png, rigged_stamp.png.
import { SFX } from './sfx.js';

export const GAG_DURATION = 5; // s ajoutees au retour lobby (serveur: END_SCREEN)
const T_GLITCH = 2500, T_STAMP = 2800, T_TRUMP = 3200, T_BANNER = 4000;
const ASSETS = { pose: 'sprites/trump_win_pose.png', banner: 'sprites/trump_win_banner.png', stamp: 'sprites/rigged_stamp.png', fallback: 'sprites/trump.png' };
const imgs = {};
export function preloadGag() {
  for (const [k, src] of Object.entries(ASSETS)) {
    if (imgs[k]) continue;
    const im = new Image(); im.onerror = () => { im.failed = true; }; im.src = '/' + src; imgs[k] = im;
  }
}
const ok = (im) => im && im.complete && !im.failed && im.naturalWidth > 0;

const CSS = `
#gag{position:fixed;inset:0;z-index:9;pointer-events:none;overflow:hidden}
#gag canvas{position:absolute;inset:0;width:100%;height:100%}
#end.gag-glitch #endBox{animation:gagGlitch .3s steps(6) 1}
#end.gag-shake{animation:gagShake .35s linear 1}
@keyframes gagGlitch{0%{transform:translate(0);filter:none}
 20%{transform:translate(-8px,3px);filter:drop-shadow(6px 0 0 #f00c) drop-shadow(-6px 0 0 #0ffc)}
 40%{transform:translate(7px,-4px) skewX(6deg);filter:drop-shadow(-8px 0 0 #f00c) drop-shadow(8px 0 0 #0ffc)}
 60%{transform:translate(-5px,2px);filter:hue-rotate(90deg) drop-shadow(5px 0 0 #f0fc)}
 80%{transform:translate(4px,0) skewX(-4deg);filter:drop-shadow(-4px 0 0 #0f0c)}
 100%{transform:translate(0);filter:none}}
@keyframes gagShake{0%,100%{transform:translate(0)}20%{transform:translate(-10px,6px)}40%{transform:translate(9px,-7px)}60%{transform:translate(-6px,4px)}80%{transform:translate(4px,-2px)}}
`;

let raf = 0, timers = [], t0 = 0, confetti = [], soundStamp = false, soundTrump = false;
export function stopGag() {
  cancelAnimationFrame(raf); raf = 0;
  for (const t of timers) clearTimeout(t); timers = [];
  document.getElementById('gag')?.remove();
  const end = document.getElementById('end'); if (end) end.classList.remove('gag-glitch', 'gag-shake');
}

export function startGag() {
  stopGag(); preloadGag();
  if (!document.getElementById('gagCss')) { const s = document.createElement('style'); s.id = 'gagCss'; s.textContent = CSS; document.head.appendChild(s); }
  const end = document.getElementById('end');
  const wrap = document.createElement('div'); wrap.id = 'gag';
  const cv = document.createElement('canvas'); wrap.appendChild(cv); document.body.appendChild(wrap);
  t0 = performance.now(); confetti = []; soundStamp = soundTrump = false;
  timers.push(setTimeout(() => end?.classList.add('gag-glitch'), T_GLITCH));
  timers.push(setTimeout(() => { end?.classList.remove('gag-glitch'); end?.classList.add('gag-shake'); }, T_STAMP + 180));
  timers.push(setTimeout(() => end?.classList.remove('gag-shake'), T_STAMP + 560));
  const loop = () => { try { draw(cv); } catch (e) { console.warn('[gag]', e); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}

const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
function pixelText(g, txt, x, y, size, fill, stroke = '#000') {
  g.font = `900 ${size}px ui-monospace,Menlo,Consolas,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'miter'; g.lineWidth = Math.max(4, size / 7); g.strokeStyle = stroke; g.strokeText(txt, x, y);
  g.fillStyle = '#000'; g.fillText(txt, x + size / 14, y + size / 14); g.fillStyle = fill; g.fillText(txt, x, y);
}

function draw(cv) {
  const W = innerWidth, H = innerHeight;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H);
  const t = performance.now() - t0, S = Math.min(W, H);
  // Glitch: lignes horizontales et bandes RGB.
  if (t >= T_GLITCH && t < T_GLITCH + 300) {
    for (let i = 0; i < 14; i++) {
      const y = Math.random() * H, h = 2 + Math.random() * 14;
      g.fillStyle = ['#ff003c55', '#00e5ff55', '#ffffff33'][i % 3]; g.fillRect((Math.random() - 0.5) * 60, y, W, h);
    }
    g.fillStyle = '#0003'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  }
  // Voile sombre progressif a l'arrivee de Trump.
  if (t >= T_TRUMP) { g.fillStyle = `rgba(4,8,20,${0.55 * ease((t - T_TRUMP) / 400)})`; g.fillRect(0, 0, W, H); }
  // Tampon RIGGED!: ecrase (grand -> petit), rebond.
  if (t >= T_STAMP) {
    if (!soundStamp) { soundStamp = true; stampSfx(); }
    const k = (t - T_STAMP) / 1000;
    const sc = k < 0.18 ? 3 - 2.1 * (k / 0.18) : 0.9 + 0.1 * Math.min(1, (k - 0.18) / 0.15) + (k < 0.45 ? 0.08 * Math.sin((k - 0.18) * 40) * (1 - (k - 0.18) / 0.27) : 0);
    g.save(); g.translate(W * 0.5, t >= T_TRUMP ? H * 0.2 : H * 0.5); g.rotate(-0.22); g.scale(sc, sc);
    g.globalAlpha = Math.min(1, k / 0.08);
    if (ok(imgs.stamp)) { const w = S * 0.7, h = w * imgs.stamp.naturalHeight / imgs.stamp.naturalWidth; g.drawImage(imgs.stamp, -w / 2, -h / 2, w, h); }
    else {
      const w = S * 0.72, h = S * 0.2, b = Math.max(6, S * 0.014);
      g.fillStyle = '#d4142aee'; g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = '#fff'; g.fillRect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b);
      g.fillStyle = '#d4142a'; g.fillRect(-w / 2 + 2 * b, -h / 2 + 2 * b, w - 4 * b, h - 4 * b);
      pixelText(g, 'RIGGED!', 0, 0, h * 0.62, '#fff', '#5a0010');
    }
    g.restore();
  }
  // Trump: glissade depuis la gauche, arret au centre, rebond de victoire.
  if (t >= T_TRUMP) {
    if (!soundTrump) { soundTrump = true; try { if (!SFX.play('fx_victory', 'gag_victory')) SFX.win(); } catch (e) {} }
    const k = (t - T_TRUMP) / 1000, slide = ease(k / 0.55);
    const x = -S * 0.4 + (W / 2 + S * 0.4) * slide, arrived = k > 0.55;
    const bob = arrived ? Math.abs(Math.sin((k - 0.55) * 5)) * S * 0.03 : 0;
    const im = ok(imgs.pose) ? imgs.pose : ok(imgs.fallback) ? imgs.fallback : null;
    const h = S * (ok(imgs.pose) ? 0.55 : 0.45), cy = H * 0.64;
    // Etoiles autour de Trump.
    if (arrived) for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + k * 1.5, r = S * 0.28 + Math.sin(k * 4 + i) * S * 0.02;
      star(g, W / 2 + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, S * 0.018 * (1 + 0.4 * Math.sin(k * 8 + i)));
    }
    if (im) {
      const w = h * im.naturalWidth / im.naturalHeight;
      g.save(); g.translate(x, cy - bob);
      if (!arrived) g.rotate(-0.12 * (1 - slide)); // penche en glissade
      g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
    }
    if (arrived) {
      if (confetti.length < 220) for (let i = 0; i < 6; i++) confetti.push({ x: Math.random() * W, y: -20, vy: 1.5 + Math.random() * 3, vx: (Math.random() - 0.5) * 2, r: Math.random() * 6, s: 4 + Math.random() * 6, c: ['#ffd23f', '#f5b300', '#fff3b0', '#e8a317'][i % 4] });
      for (const c of confetti) {
        c.x += c.vx; c.y += c.vy; c.r += 0.1; if (c.y > H + 20) { c.y = -20; c.x = Math.random() * W; }
        g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillStyle = c.c; g.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); g.restore();
      }
    }
  }
  // Banniere TRUMP WINS / AS ALWAYS: descend du haut.
  if (t >= T_BANNER) {
    const k = ease((t - T_BANNER) / 500), bw = Math.min(W * 0.9, S * 1.3), bh = S * 0.24;
    const y = -bh + (H * 0.06 + bh) * k;
    if (ok(imgs.banner)) { const h = bw * imgs.banner.naturalHeight / imgs.banner.naturalWidth; g.drawImage(imgs.banner, (W - bw) / 2, y, bw, h); }
    else {
      const b = Math.max(5, S * 0.01);
      g.fillStyle = '#000'; g.fillRect((W - bw) / 2 + b, y + b, bw, bh);
      g.fillStyle = '#f5b300'; g.fillRect((W - bw) / 2, y, bw, bh);
      g.fillStyle = '#1b2a4a'; g.fillRect((W - bw) / 2 + b, y + b, bw - 2 * b, bh - 2 * b);
      pixelText(g, 'TRUMP WINS', W / 2, y + bh * 0.38, bh * 0.4, '#ffd23f');
      pixelText(g, 'AS ALWAYS', W / 2, y + bh * 0.76, bh * 0.2, '#fff');
    }
  }
}

function star(g, x, y, r) {
  g.fillStyle = '#fff3b0'; g.fillRect(x - r / 3, y - r, r * 2 / 3, r * 2); g.fillRect(x - r, y - r / 3, r * 2, r * 2 / 3);
  g.fillStyle = '#ffd23f'; g.fillRect(x - r / 3, y - r / 3, r * 2 / 3, r * 2 / 3);
}
// Impact du tampon: grave + bruit court (passe par SFX.master, donc coupe par le mute).
function stampSfx() { try { SFX._tone('square', 160, 40, 0.25, 0.6); SFX._noise(0.18, 0.5); SFX._tone('sawtooth', 90, 30, 0.3, 0.4, 0.02); } catch (e) {} }
