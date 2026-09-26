// Vue de jeu sur la manette: le combat rendu sur le telephone, camera qui suit mon perso.
// Reutilise le rendu de l'ecran hote (client/scene.js) avec le parametre camera. Donnees: MSG.VIEW (filtre autour de moi).
import { render, pushEvents, decorPoint } from '../scene.js';

const RENDER_DELAY = 70, MAX_EXTRAPOLATION = 50; // identiques a l'ecran hote
const ZOOM = 1.75, FOLLOW = 8; // zoom 1.75x sur le decor 960x540, suivi lisse (lerp exponentiel)
const MAX_DPR = 2;

export function createView(canvas, { getArena, getCharacters, myId, fpsEl }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let updates = [], clockOffset = null, active = false, raf = 0;
  const cam = { x: 480, y: 422, zoom: ZOOM, me: null, ready: false };
  let lastFrame = 0, fpsFrames = 0, fpsAcc = 0;

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
    const me = st && st.players.find((p) => p.id === myId());
    cam.me = myId();
    if (me) {
      const [tx, ty] = decorPoint(arena, me.x, me.y);
      if (!cam.ready) { cam.x = tx + 55; cam.y = ty - 30; cam.ready = true; }
      const k = 1 - Math.exp(-FOLLOW * dt);
      // perso un peu a gauche du centre (zone libre entre joystick et boutons), un peu au-dessus des pieds
      cam.x += (tx + 55 - cam.x) * k; cam.y += (ty - 30 - cam.y) * k;
    }
    ctx.imageSmoothingEnabled = false;
    render(ctx, canvas.width, canvas.height, arena, st, getCharacters(), cam);
    if (fpsEl) { fpsFrames++; fpsAcc += dt; if (fpsAcc >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps`; fpsFrames = 0; fpsAcc = 0; } }
  }

  return {
    push,
    setActive(on) {
      if (on === active) return;
      active = on; canvas.hidden = !on;
      if (on) { lastFrame = 0; cam.ready = false; resize(); raf = requestAnimationFrame(frame); }
      else { cancelAnimationFrame(raf); raf = 0; updates = []; }
    },
    camera: cam,
  };
}
