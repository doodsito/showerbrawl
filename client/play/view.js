// Vue de jeu sur la manette: camera fixe qui cadre l'octogone entier, mon perso reste mis en evidence (fleche + anneau).
// Reutilise le rendu de l'ecran hote (client/scene.js) avec le parametre camera. Donnees: MSG.VIEW (toute l'arene).
import { render, pushEvents, OCT } from '../scene.js';

const RENDER_DELAY = 70, MAX_EXTRAPOLATION = 50; // identiques a l'ecran hote
// Boite a cadrer dans le decor 960x540: le sol de l'octogone + la hauteur des sprites et des noms au bord du toit.
const BOX = { x0: OCT.cx - OCT.hw - 40, x1: OCT.cx + OCT.hw + 40, y0: OCT.cy - OCT.hh - 140, y1: OCT.cy + OCT.hh + 14 };
const MARGIN = 0.03; // petite marge laterale (fraction de la largeur)
const LIFT = 0.3; // part de l'espace vertical libre laissee au-dessus: cadrage decale vers le haut, loin du joystick et des boutons

// Cadrage fixe (px canvas): octogone entier, centre en x, remonte en y. Recalcule a chaque changement de taille.
// Portrait: la vue n'occupe que le haut de l'ecran, octogone centre verticalement et agrandi au maximum (marge minimale).
export function fitCamera(W, H, portrait = false) {
  const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0, m = portrait ? 0.01 : MARGIN;
  const scale = Math.min((W * (1 - 2 * m)) / bw, (H * (1 - m)) / bh);
  const tx = W / 2 - ((BOX.x0 + BOX.x1) / 2) * scale;
  const ty = (H - bh * scale) * (portrait ? 0.5 : LIFT) - BOX.y0 * scale;
  return { scale, tx, ty };
}
const MAX_DPR = 2;

export function createView(canvas, { getArena, getCharacters, myId, fpsEl }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let updates = [], clockOffset = null, active = false, raf = 0;
  const cam = { fit: null, me: null, ready: false };
  let lastFrame = 0, fpsFrames = 0, fpsAcc = 0;
  const portraitMq = matchMedia('(orientation: portrait)');

  // --- interpolation (meme principe que client/host.js) ---
  const serverNow = () => performance.now() + (clockOffset ?? 0) - RENDER_DELAY;
  function push(v) {
    const off = v.t - performance.now();
    clockOffset = clockOffset == null ? off : clockOffset + (off - clockOffset) * 0.1; // horloge lissee
    if (v.events?.length) pushEvents(v.events);
    updates.push(v);
    const t = serverNow();
    let b = -1; for (let i = updates.length - 1; i >= 0; i--) if (updates[i].t <= t) { b = i; break; }
    if (b > 1) updates.splice(0, b - 1); // garde le precedent pour extrapoler
  }
  const lerp = (a, b, r) => a + (b - a) * r;
  function lerpPlayers(l1, l2, r) {
    const out = [];
    for (const o of l2) {
      let prev = null; for (const q of l1) if (q.id === o.id) { prev = q; break; }
      out.push(prev ? { ...o, x: lerp(prev.x, o.x, r), y: lerp(prev.y, o.y, r) } : o);
    }
    return out;
  }
  function current() {
    if (!updates.length) return null;
    const t = serverNow();
    let b = -1; for (let i = updates.length - 1; i >= 0; i--) if (updates[i].t <= t) { b = i; break; }
    if (b < 0) return updates[0];
    const a = updates[b], n = updates[b + 1];
    if (!n) {
      const prev = updates[b - 1];
      if (!prev || a.t <= prev.t) return a;
      const ahead = Math.min(MAX_EXTRAPOLATION, Math.max(0, t - a.t));
      return { ...a, players: lerpPlayers(prev.players, a.players, 1 + ahead / (a.t - prev.t)) };
    }
    return { ...n, players: lerpPlayers(a.players, n.players, (t - a.t) / ((n.t - a.t) || 1)) };
  }

  // --- canvas a la resolution de l'appareil (dpr plafonne) ---
  function resize() {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  window.addEventListener('resize', resize);

  function frame(now) {
    raf = active ? requestAnimationFrame(frame) : 0;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0; lastFrame = now;
    const st = current(), arena = getArena();
    if (!arena) return;
    resize();
    cam.me = myId();
    const portrait = portraitMq.matches;
    if (!cam.fit || cam.fit.W !== canvas.width || cam.fit.H !== canvas.height || cam.fit.portrait !== portrait) cam.fit = { ...fitCamera(canvas.width, canvas.height, portrait), W: canvas.width, H: canvas.height, portrait };
    cam.ready = true;
    ctx.imageSmoothingEnabled = false;
    render(ctx, canvas.width, canvas.height, arena, st, getCharacters(), cam);
    if (fpsEl) { fpsFrames++; fpsAcc += dt; if (fpsAcc >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps`; fpsFrames = 0; fpsAcc = 0; } }
  }

  return {
    push,
    setActive(on) {
      if (on === active) return;
      active = on; canvas.hidden = !on;
      if (on) { lastFrame = 0; resize(); raf = requestAnimationFrame(frame); }
      else { cancelAnimationFrame(raf); raf = 0; updates = []; }
    },
    camera: cam,
  };
}
