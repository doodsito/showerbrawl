import {getImage, loadImage, getSprite} from './sprites.js';

// Public art is loaded during the lobby, before short first-cast animations begin.
export const COMBAT_ART = [
  'sprites/maduro_mustache_v1.png',
  'sprites/maduro_attack.png','sprites/xi_attack.png','sprites/maduro_plane_v1.png','sprites/xi_hammer_v2.png',
  'sprites/biden_nap_v2.png','sprites/biden_bicycle.svg','sprites/biden_icecream.svg',
  'sprites/mic_object_v1.png', 'sprites/stamp_object_v1.png',
  'sprites/trump_defense.png', 'sprites/obama_attack.png',
  'sprites/musk_attack.png', 'sprites/musk_super.png',
];
export function preloadCombatArt(characters = {}) {
  for (const path of COMBAT_ART) getImage(path);
  for (const c of Object.values(characters)) { if (/\.(png|webp|gif|jpe?g)$/i.test(c.sprite || '')) getImage(c.sprite); if (c.super?.anim?.src) getImage(c.super.anim.src); }
}

// Lobby: telecharge ET decode (img.decode) chaque image de combat et chaque sprite de perso, puis les dessine une fois
// a taille native dans un canvas jetable (upload GPU). Le rendu du match attend isCombatArtReady().
let warmKey = '', warmPromise = null, ready = false;
export function isCombatArtReady() { return ready; }
export function warmCombatArt(characters = {}) {
  if (typeof document === 'undefined') return Promise.resolve();
  const ids = Object.keys(characters).filter((id) => id !== '_schema');
  const key = ids.map((id) => id + (characters[id].sprite || '') + (characters[id].super?.anim?.src || '')).join('|');
  if (key === warmKey && warmPromise) return warmPromise;
  warmKey = key; ready = false;
  const imgs = COMBAT_ART.map((p) => loadImage(p));
  for (const id of ids) {
    const c = characters[id];
    imgs.push(loadImage(c.sprite, id));
    if (c.super?.anim?.src) imgs.push(loadImage(c.super.anim.src));
    getSprite(id); // crane de repli, genere une fois
  }
  const decode = (im) => !im ? null : im.decode ? im.decode().catch(() => settle(im)) : settle(im);
  const settle = (im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }));
  const p = warmPromise = Promise.allSettled(imgs.map(decode)).then(() => {
    if (p !== warmPromise) return;
    try {
      const k = document.createElement('canvas'), g = k.getContext('2d');
      let w = 1, h = 1; for (const im of imgs) if (im?.naturalWidth) { w = Math.max(w, im.naturalWidth); h = Math.max(h, im.naturalHeight); }
      k.width = w; k.height = h;
      for (const im of imgs) if (im?.naturalWidth && !im.failed) g.drawImage(im, 0, 0);
      k.width = k.height = 0;
    } catch (e) {}
    ready = true;
    console.log('[assets] images de combat decodees', imgs.length);
  });
  return p;
}
