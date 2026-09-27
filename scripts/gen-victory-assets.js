// Genere les 3 PNG de la victoire Trump (pixel art, transparent) dans client/public/sprites/.
// Dessin sur une petite grille puis agrandissement entier nearest-neighbor: aucun flou, aucun anti-aliasing.
// Usage: node scripts/gen-victory-assets.js
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const OUT = new URL('../client/public/sprites/', import.meta.url);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  // Trait epais: tampon carre le long du segment.
  line(x0, y0, x1, y1, r, c) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 || 1;
    for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; this.rect(Math.round(x - r), Math.round(y - r), 2 * r + 1, 2 * r + 1, c); }
  }
  // Contour dur de 1 px autour de tout ce qui est dessine.
  outline(c, n = 1) {
    for (let k = 0; k < n; k++) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
      for (const [x, y] of add) this.set(x, y, c);
    }
  }
}

function png(grid, scale, file) {
  const W = grid.w * scale, H = grid.h * scale, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const c = grid.get(Math.floor(x / scale), Math.floor(y / scale)), o = y * (W * 4 + 1) + 1 + x * 4;
      if (c) { const v = hex(c); raw[o] = v[0]; raw[o + 1] = v[1]; raw[o + 2] = v[2]; raw[o + 3] = 255; }
    }
  }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(new URL(file, OUT), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
  console.log(file, W + 'x' + H);
}

// Police bitmap 5x7.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'], ' ': Array(7).fill('00000'),
};
const textW = (s, sx, gap) => s.length * 5 * sx + (s.length - 1) * gap;
// bold: chaque pixel deborde d'un pixel de police a droite (lettres grasses de tampon).
function text(g, s, x, y, sx, sy, gap, c, bold = false) {
  const cw = (bold ? 6 : 5) * sx;
  [...s].forEach((ch, i) => FONT[ch].forEach((row, j) => [...row].forEach((b, k) => { if (b === '1') g.rect(x + i * (cw + gap) + k * sx, y + j * sy, bold ? 2 * sx : sx, sy, c); })));
}
function star(g, cx, cy, c, hi) { g.rect(cx - 1, cy - 3, 3, 7, c); g.rect(cx - 3, cy - 1, 7, 3, c); g.rect(cx - 2, cy - 2, 5, 5, c); g.set(cx, cy, hi); }
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); }

// ---------- trump_win_pose.png: 128x128 x4 = 512x512 ----------
{
  const g = new Grid(128, 128), OUTL = '#140c1c';
  const NAVY = '#1f3470', NAVY_D = '#15224c', NAVY_L = '#2e4a94', SKIN = '#f2a764', SKIN_D = '#cf7c3e', SKIN_L = '#ffc98e';
  const HAIR = '#f7c843', HAIR_D = '#c9922a', HAIR_L = '#fff2a0', RED = '#d42a2a', RED_D = '#8e1620', WHITE = '#f4f4f4', SHOE = '#1c1c24';
  // Jambes en garde large, pied gauche legerement avance.
  g.line(56, 86, 44, 118, 6, NAVY); g.line(72, 86, 84, 116, 6, NAVY);
  g.line(58, 88, 48, 116, 1, NAVY_L); g.line(76, 88, 88, 114, 2, NAVY_D);
  g.rect(33, 118, 20, 7, SHOE); g.rect(33, 118, 6, 2, '#3a3a48'); // pied avance: touche le bas
  g.rect(78, 116, 18, 7, SHOE); g.rect(90, 116, 6, 2, '#3a3a48');
  // Torse bombe.
  g.rect(40, 50, 48, 38, NAVY); g.rect(38, 56, 52, 26, NAVY); g.rect(80, 50, 8, 38, NAVY_D); g.rect(40, 50, 6, 36, NAVY_L);
  g.rect(40, 84, 48, 6, NAVY_D);
  // Chemise en V + cravate rouge.
  for (let j = 0; j < 22; j++) g.rect(64 - Math.max(1, 10 - (j >> 1)), 48 + j, Math.max(2, 20 - j), 1, WHITE);
  g.rect(61, 50, 6, 4, RED); g.rect(62, 54, 4, 26, RED); g.rect(61, 78, 6, 4, RED); g.rect(65, 54, 1, 26, RED_D); g.set(63, 81, RED_D);
  g.rect(52, 70, 3, 2, '#e8c640'); // pin
  // Bras leves, poings au-dessus de la tete.
  g.line(44, 54, 30, 22, 5, NAVY); g.line(84, 54, 98, 22, 5, NAVY);
  g.line(42, 52, 29, 24, 1, NAVY_L); g.line(88, 54, 102, 24, 1, NAVY_D);
  g.rect(24, 16, 12, 4, WHITE); g.rect(92, 16, 12, 4, WHITE); // manchettes
  g.rect(23, 4, 14, 13, SKIN); g.rect(91, 4, 14, 13, SKIN);
  for (const fx of [23, 91]) { g.rect(fx, 4, 14, 2, SKIN_L); for (let k = 1; k < 4; k++) g.rect(fx + k * 3 + 1, 5, 1, 5, SKIN_D); g.rect(fx, 13, 14, 1, SKIN_D); }
  // Tete: visage, sourire enorme.
  g.rect(55, 44, 18, 6, SKIN_D);
  g.rect(50, 22, 28, 26, SKIN); g.rect(52, 46, 24, 3, SKIN); g.rect(72, 24, 6, 24, SKIN_D); g.rect(48, 30, 3, 8, SKIN); g.rect(77, 30, 3, 8, SKIN_D);
  g.rect(54, 30, 7, 2, HAIR_D); g.rect(67, 30, 7, 2, HAIR_D); // sourcils
  g.rect(55, 33, 5, 3, WHITE); g.rect(68, 33, 5, 3, WHITE); g.rect(57, 33, 2, 3, '#2a5bd0'); g.rect(70, 33, 2, 3, '#2a5bd0');
  g.rect(62, 35, 4, 5, SKIN_D); // nez
  g.rect(54, 40, 20, 6, '#5a1420'); g.rect(55, 40, 18, 2, WHITE); g.rect(57, 44, 14, 2, '#c03040'); g.rect(53, 39, 2, 2, SKIN_D); g.rect(73, 39, 2, 2, SKIN_D);
  // Meche doree balayee.
  g.rect(47, 14, 34, 10, HAIR); g.rect(45, 18, 6, 14, HAIR); g.rect(78, 18, 5, 12, HAIR_D); g.rect(50, 12, 26, 3, HAIR);
  g.rect(44, 20, 24, 6, HAIR); g.rect(40, 22, 8, 4, HAIR); g.rect(52, 14, 20, 2, HAIR_L); g.rect(46, 20, 14, 1, HAIR_L);
  g.rect(60, 24, 20, 2, HAIR_D); g.rect(74, 16, 7, 8, HAIR_D);
  g.outline(OUTL);
  png(g, 4, 'trump_win_pose.png');
}

// ---------- trump_win_banner.png: 256x96 x4 = 1024x384 ----------
{
  const g = new Grid(256, 96), OUTL = '#140c1c';
  const GOLD = '#f5b82e', GOLD_D = '#b8781c', GOLD_L = '#ffe680', GOLD_DD = '#7a4a10', NAVY = '#172a5c', RED = '#d42a2a', BLUE = '#2a5bd0', WHITE = '#f4f4f4';
  // Queues du ruban (derriere), encoches.
  for (const [x0, dir] of [[26, -1], [214, 1]]) {
    g.rect(x0, 30, 16, 30, GOLD_D);
    const nx = dir < 0 ? x0 : x0 + 15;
    for (let j = 0; j < 15; j++) { const d = 7 - Math.abs(7 - j); for (let k = 0; k < d; k++) g.set(nx - dir * k, 38 + j, null); }
    g.rect(dir < 0 ? x0 + 12 : x0, 30, 4, 30, GOLD_DD);
  }
  // Ruban principal dore.
  g.rect(38, 10, 180, 60, GOLD); g.rect(38, 10, 180, 3, GOLD_L); g.rect(38, 66, 180, 4, GOLD_D);
  g.rect(44, 16, 168, 46, NAVY); g.rect(44, 16, 168, 2, '#0d1a3c');
  for (let x = 40; x < 216; x += 8) { g.set(x, 12, WHITE); } // reflets
  // TRUMP WINS: or, contour rouge, bleu puis sombre.
  const t = 'TRUMP WINS', sx = 3, sy = 4, gap = 3, tw = textW(t, sx, gap);
  const tg = new Grid(256, 96); text(tg, t, 128 - (tw >> 1), 20, sx, sy, gap, GOLD);
  for (let y = 20; y < 48; y++) for (let x = 0; x < 256; x++) if (tg.get(x, y)) tg.set(x, y, y < 28 ? GOLD_L : y > 40 ? GOLD_D : GOLD);
  tg.outline(RED); tg.outline(BLUE); tg.outline(OUTL);
  for (let i = 0; i < tg.px.length; i++) if (tg.px[i]) g.px[i] = tg.px[i];
  // Bandeau AS ALWAYS.
  g.rect(78, 64, 100, 20, RED); g.rect(78, 64, 100, 2, '#ff6a5a'); g.rect(78, 82, 100, 2, '#8e1620');
  const s = 'AS ALWAYS', sw = textW(s, 2, 2); const sg = new Grid(256, 96); text(sg, s, 128 - (sw >> 1), 67, 2, 2, 2, WHITE); sg.outline(OUTL);
  for (let i = 0; i < sg.px.length; i++) if (sg.px[i]) g.px[i] = sg.px[i];
  // Etoiles.
  for (const [x, y] of [[52, 54], [204, 54], [66, 76], [190, 76], [128, 5]]) star(g, x, y, GOLD_L, WHITE);
  // Petits drapeaux americains de chaque cote.
  for (const [px, flip] of [[8, 1], [247, -1]]) {
    g.rect(px, 18, 2, 60, '#8a8a96'); g.rect(px - 1, 15, 4, 3, GOLD);
    const fx = flip > 0 ? px + 2 : px - 20;
    for (let j = 0; j < 13; j++) g.rect(fx, 20 + j, 20, 1, j % 2 ? WHITE : RED);
    const cx = flip > 0 ? fx : fx + 11; g.rect(cx, 20, 9, 7, BLUE);
    for (let j = 0; j < 3; j++) for (let k = 0; k < 4; k++) if ((j + k) % 2 === 0) g.set(cx + 1 + k * 2, 21 + j * 2, WHITE);
  }
  g.outline(OUTL);
  png(g, 4, 'trump_win_banner.png');
}

// ---------- rigged_stamp.png: 256x128 x2 = 512x256 ----------
{
  const RED = '#d8202a', RED_D = '#961420', src = new Grid(256, 128), rnd = rng(1776);
  src.rect(16, 26, 224, 76, RED); src.rect(23, 33, 210, 62, null); src.rect(27, 37, 202, 54, RED); src.rect(31, 41, 194, 46, null);
  const t = 'RIGGED!', tw = t.length * 24 + 6 * 4; text(src, t, 128 - (tw >> 1), 43, 4, 6, 4, RED, true);
  // Encre usee: trous, bords irreguliers, taches plus sombres.
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    if (!src.get(x, y)) continue; const r = rnd();
    if (r < 0.04) src.set(x, y, null); else if (r < 0.1) src.set(x, y, RED_D);
  }
  for (let k = 0; k < 24; k++) { const x = 16 + rnd() * 224 | 0, y = 26 + rnd() * 76 | 0, w = 1 + rnd() * 5 | 0; src.rect(x, y, w, 1 + (rnd() * 2 | 0), null); }
  for (let k = 0; k < 30; k++) src.set(8 + rnd() * 240 | 0, 18 + rnd() * 92 | 0, RED);
  // Rotation horaire legere (echantillonnage nearest-neighbor inverse).
  const g = new Grid(256, 128), a = 7 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const dx = x - 128, dy = y - 64, sx = Math.round(128 + dx * ca + dy * sa), sy = Math.round(64 - dx * sa + dy * ca);
    g.set(x, y, src.get(sx, sy));
  }
  png(g, 2, 'rigged_stamp.png');
}
