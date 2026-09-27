// Sequence de victoire Trump (ecran hote, pur visuel), jouee seulement si l'equipe gagnante compte un Trump.
// Arene figee, voile, Trump en pose de victoire, banniere TRUMP WINS / AS ALWAYS, puis tampon RIGGED! brutal.
// Assets pixel art (scripts/gen-victory-assets.js): sprites/trump_win_pose.png, trump_win_banner.png, rigged_stamp.png.
import { SFX } from './sfx.js';

export const GAG_DURATION = 5; // s ajoutees au retour lobby (serveur: END_SCREEN)
export const TRUMP_ID = 'trump'; // cle de shared/characters.json
const T_DIM = 350, T_POSE = 550, T_BANNER = 800, T_STAMP = 1500;
const ASSETS = { pose: 'sprites/trump_win_pose.png', banner: 'sprites/trump_win_banner.png', stamp: 'sprites/rigged_stamp.png' };
const GRID = { pose: 128, banner: 256, stamp: 256 }; // largeur de la grille pixel art de chaque PNG
const imgs = {};
export function preloadGag() {
  for (const [k, src] of Object.entries(ASSETS)) {
    if (imgs[k]) continue;
    const im = new Image(); im.onerror = () => { im.failed = true; }; im.src = '/' + src; imgs[k] = im;
  }
}
const ok = (im) => im && im.complete && !im.failed && im.naturalWidth > 0;

// Le vainqueur vient du payload END du serveur (winner + players): aucune logique de victoire dupliquee ici.
export function trumpWon(d) {
  return (d?.winner === 'A' || d?.winner === 'B') && (d.players || []).some((p) => p.team === d.winner && p.character === TRUMP_ID);
}

const CSS = `
#gag{position:fixed;inset:0;z-index:9;pointer-events:none;overflow:hidden}
#gag canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges}
#end.trump-win{z-index:10;background:none;align-items:flex-end;pointer-events:none}
#end.trump-win #endBox{background:none;border:0;box-shadow:none;animation:none;padding:0 0 10px;width:100%}
#end.trump-win #endBox>:not(.foot){display:none}
#end.trump-win .foot{pointer-events:auto;margin:0;color:#fff;text-shadow:2px 2px 0 #000}
`;

let raf = 0, t0 = 0, soundStamp = false, soundTrump = false;
export function stopGag() {
  cancelAnimationFrame(raf); raf = 0;
  document.getElementById('gag')?.remove();
  document.getElementById('end')?.classList.remove('trump-win');
}

export function startGag() {
  stopGag(); preloadGag();
  if (!document.getElementById('gagCss')) { const s = document.createElement('style'); s.id = 'gagCss'; s.textContent = CSS; document.head.appendChild(s); }
  document.getElementById('end')?.classList.add('trump-win');
  const wrap = document.createElement('div'); wrap.id = 'gag';
  const cv = document.createElement('canvas'); wrap.appendChild(cv); document.body.appendChild(wrap);
  t0 = performance.now(); soundStamp = soundTrump = false;
  const loop = () => { try { draw(cv); } catch (e) { console.warn('[gag]', e); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}

// Progression en paliers (animation arcade, pas d'easing lisse).
const steps = (x, n) => Math.floor(Math.min(1, Math.max(0, x)) * n) / n;

// Composition: banniere en haut, Trump dessous (poings sous la banniere), tampon en travers de ses jambes.
// Taille d'un pixel de grille arrondie a l'entier quand c'est possible: rendu net, ratio conserve.
export function layout(W, H) {
  const m = Math.max(12, Math.min(W, H) * 0.03), foot = 40, availW = W - 2 * m, availH = H - 2 * m - foot;
  const snap = (w, grid) => { const k = w / grid; return (k >= 2 ? Math.floor(k) : k) * grid; };
  const bw = snap(Math.min(availW, availH / 0.92, 1280), GRID.banner), bh = bw * 0.375, over = bh * 0.15;
  const pw = snap(Math.max(0, Math.min(availW, availH - bh + over, bw * 0.75)), GRID.pose);
  const top = m + (availH - (bh - over + pw)) / 2;
  const banner = { x: (W - bw) / 2, y: top, w: bw, h: bh };
  const pose = { x: (W - pw) / 2, y: top + bh - over, w: pw, h: pw };
  const sw = snap(Math.min(bw * 0.5, availW), GRID.stamp), sh = sw / 2;
  const cx = Math.min(W - m - sw / 2, Math.max(m + sw / 2, W / 2 + pw * 0.3)), cy = Math.min(H - m - foot - sh / 2, pose.y + pw * 0.74);
  return { banner, pose, stamp: { x: cx - sw / 2, y: cy - sh / 2, w: sw, h: sh } };
}

function draw(cv) {
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H);
  const t = performance.now() - t0, L = layout(W, H);
  // Micro screen-shake a l'impact du tampon (4 secousses decroissantes).
  const ks = t - T_STAMP - 110;
  if (ks > 0 && ks < 240) { const a = Math.round(10 * (1 - ks / 240)), f = Math.floor(ks / 60); g.translate(f % 2 ? -a : a, f % 2 ? a / 2 : -a / 2); }
  // Arene visible puis voile sombre en 3 paliers.
  if (t >= T_DIM) { g.fillStyle = `rgba(4,8,20,${0.72 * steps((t - T_DIM) / 180, 3)})`; g.fillRect(-20, -20, W + 40, H + 40); }
  // Trump: surgit du bas en 4 paliers, puis sautille de victoire (2 frames).
  if (t >= T_POSE && ok(imgs.pose)) {
    if (!soundTrump) { soundTrump = true; try { if (!SFX.play('fx_victory', 'gag_victory')) SFX.win(); } catch (e) {} }
    const p = L.pose, k = steps((t - T_POSE) / 160, 4), px = p.w / GRID.pose;
    const bob = k === 1 && Math.floor((t - T_POSE) / 300) % 2 ? Math.round(2 * px) : 0;
    const dy = (1 - k) * p.h * 0.35;
    g.save(); g.globalAlpha = k > 0 ? 1 : 0; g.drawImage(imgs.pose, Math.round(p.x), Math.round(p.y + dy - bob), p.w, p.h); g.restore();
  }
  // Banniere: tombe du haut en 4 paliers, petit rebond d'un palier.
  if (t >= T_BANNER && ok(imgs.banner)) {
    const b = L.banner, e = (t - T_BANNER) / 160, k = steps(e, 4), bounce = e > 1 && e < 1.5 ? b.h * 0.04 : 0;
    g.drawImage(imgs.banner, Math.round(b.x), Math.round(b.y - (1 - k) * (b.y + b.h) + bounce), b.w, b.h);
  }
  // Tampon RIGGED!: ecrase de 2,4x a 1x en 3 paliers (110 ms) avec un leger tour, puis reste.
  if (t >= T_STAMP && ok(imgs.stamp)) {
    const s = L.stamp, k = steps((t - T_STAMP) / 110, 3), sc = 2.4 - 1.4 * k, rot = -0.12 * (1 - k);
    if (!soundStamp && k === 1) { soundStamp = true; stampSfx(); }
    g.save(); g.translate(Math.round(s.x + s.w / 2), Math.round(s.y + s.h / 2)); g.rotate(rot); g.scale(sc, sc);
    g.globalAlpha = k === 0 ? 0.6 : 1; g.drawImage(imgs.stamp, -s.w / 2, -s.h / 2, s.w, s.h); g.restore();
  }
}

// Impact du tampon: grave + bruit court (passe par SFX.master, donc coupe par le mute).
function stampSfx() { try { SFX._tone('square', 160, 40, 0.25, 0.6); SFX._noise(0.18, 0.5); SFX._tone('sawtooth', 90, 30, 0.3, 0.4, 0.02); } catch (e) {} }
