// Vue de jeu sur la manette: camera fixe qui cadre l'octogone entier, mon perso reste mis en evidence (fleche + anneau).
// Reutilise le rendu de l'ecran hote (client/scene.js) avec le parametre camera. Donnees: MSG.VIEW (toute l'arene).
import { render, pushEvents, OCT, warmRender } from '../scene.js';
import { isCombatArtReady } from '../combat-assets.js';

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
  let lastFrame = 0, fpsFrames = 0, fpsAcc = 0, warmed = false, activeSince = 0;
  const portraitMq = matchMedia('(orientation: portrait)');

  // --- interpolation (meme principe que client/host.js) ---
  const serverNow = () => performance.now() + (clockOffset ?? 0) - RENDER_DELAY;
  // Champs fixes des joueurs (name, character, team, maxHp): le serveur ne les renvoie que 2 fois par seconde.
  const statics = new Map();
  function fillStatics(players) {
    for (let i = 0; i < (players?.length || 0); i++) {
      const p = players[i];
      if (p.character !== undefined) { let c = statics.get(p.id); if (!c) { c = {}; statics.set(p.id, c); } c.name = p.name; c.character = p.character; c.team = p.team; c.maxHp = p.maxHp; }
      else { const c = statics.get(p.id); if (c) { p.name = c.name; p.character = c.character; p.team = c.team; p.maxHp = c.maxHp; } }
    }
    if (statics.size > 32) statics.clear();
  }
  function push(v) {
    fillStatics(v.players);
    const off = v.t - performance.now();
    clockOffset = clockOffset == null ? off : clockOffset + (off - clockOffset) * 0.1; // horloge lissee
    if (v.events?.length) pushEvents(v.events);
    updates.push(v);
    const t = serverNow();
    let b = -1; for (let i = updates.length - 1; i >= 0; i--) if (updates[i].t <= t) { b = i; break; }
    if (b > 1) updates.splice(0, b - 1); // garde le precedent pour extrapoler
  }
  const lerp = (a, b, r) => a + (b - a) * r;
  // Objets et tableaux reutilises d'une frame a l'autre (aucune allocation par frame).
  const outPlayers = [], pooled = new Map(), frameState = {};
  const copyInto = (dst, src) => { for (const k in dst) if (!(k in src)) delete dst[k]; for (const k in src) dst[k] = src[k]; return dst; };
  function lerpPlayers(l1, l2, r) {
    outPlayers.length = 0;
    for (let i = 0; i < l2.length; i++) {
      const o = l2[i];
      let prev = null; for (let j = 0; j < l1.length; j++) if (l1[j].id === o.id) { prev = l1[j]; break; }
      if (!prev) { outPlayers.push(o); continue; }
      let res = pooled.get(o.id); if (!res) { res = {}; pooled.set(o.id, res); }
      copyInto(res, o); res.x = lerp(prev.x, o.x, r); res.y = lerp(prev.y, o.y, r);
      outPlayers.push(res);
    }
    if (pooled.size > 32) pooled.clear();
    return outPlayers;
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
      copyInto(frameState, a); frameState.players = lerpPlayers(prev.players, a.players, 1 + ahead / (a.t - prev.t));
      return frameState;
    }
    copyInto(frameState, n); frameState.players = lerpPlayers(a.players, n.players, (t - a.t) / ((n.t - a.t) || 1));
    return frameState;
  }

  // --- canvas a la resolution de l'appareil (dpr plafonne) ---
  function resize() {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  // Taille relue seulement quand elle change (pas de lecture de layout forcee a chaque frame).
  let sizeDirty = true;
  const markDirty = () => { sizeDirty = true; };
  window.addEventListener('resize', markDirty);
  try { new ResizeObserver(markDirty).observe(canvas); } catch (e) {}

  function frame(now) {
    raf = active ? requestAnimationFrame(frame) : 0;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0; lastFrame = now;
    const st = current(), arena = getArena();
    if (!arena) return;
    if (sizeDirty) { sizeDirty = false; resize(); }
    cam.me = myId();
    const portrait = portraitMq.matches;
    if (!cam.fit || cam.fit.W !== canvas.width || cam.fit.H !== canvas.height || cam.fit.portrait !== portrait) cam.fit = { ...fitCamera(canvas.width, canvas.height, portrait), W: canvas.width, H: canvas.height, portrait };
    cam.ready = true;
    const ready = isCombatArtReady() || now - activeSince > 3000;
    // Compte a rebours: une frame invisible de l'arene complete (hors ecran) chauffe le rendu avant FIGHT!.
    if (!warmed && ready) { warmed = true; try { warmRender(canvas.width, canvas.height, arena, getCharacters(), cam); } catch (e) {} }
    ctx.imageSmoothingEnabled = false;
    if (ready) render(ctx, canvas.width, canvas.height, arena, st, getCharacters(), cam);
    if (fpsEl) { fpsFrames++; fpsAcc += dt; if (fpsAcc >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps`; fpsFrames = 0; fpsAcc = 0; } }
  }

  return {
    push,
    setActive(on) {
      if (on === active) return;
      active = on; canvas.hidden = !on;
      if (on) { lastFrame = 0; activeSince = performance.now(); resize(); raf = requestAnimationFrame(frame); }
      else { cancelAnimationFrame(raf); raf = 0; updates = []; }
    },
    camera: cam,
  };
}
