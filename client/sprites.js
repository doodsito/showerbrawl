import {assetUrl} from './version.js';
// Crânes politiciens en pixel art générés au runtime (aucune image).
const S = 16;
const cache = {};
const LOOKS = {
  trump: { skin: '#f2a25c', hair: '#ffb52e', hairStyle: 'swoop', glasses: false },
  biden: { skin: '#f1d2b8', hair: '#f4f4f4', hairStyle: 'thin', glasses: true },
  musk: { skin: '#f0c9a8', hair: '#3a2a1e', hairStyle: 'swoop', glasses: false },
  obama: { skin: '#8a5a3c', hair: '#2a2a2a', hairStyle: 'thin', glasses: false },
  harris: { skin: '#b27a55', hair: '#1f1a17', hairStyle: 'swoop', glasses: false },
  maduro: { skin: '#c79270', hair: '#1c1c1c', hairStyle: 'thin', glasses: false },
  sanders: { skin: '#f2cfb4', hair: '#ececec', hairStyle: 'thin', glasses: true },
  schwarzenegger: { skin: '#d9a07a', hair: '#6b4a2e', hairStyle: 'thin', glasses: false },
  macron: { skin: '#f0cdb0', hair: '#5a4632', hairStyle: 'swoop', glasses: false },
  zelensky: { skin: '#e3b999', hair: '#3b3b36', hairStyle: 'thin', glasses: false },
};
const images = {};
const isImage = (id) => typeof id === 'string' && /\.(png|webp|gif|jpe?g)$/i.test(id);

// URL du PNG pour un perso: le champ sprite s'il est un chemin, sinon sprites/<id>.png par convention.
export function spriteUrl(sprite, charId) {
  if (isImage(sprite)) return assetUrl(sprite);
  const id = sprite || charId;
  return id ? assetUrl(`sprites/${id}.png`) : null;
}

// Charge le PNG une fois (cache), log le resultat. Renvoie l'image prete ou null (crane en fallback).
export function getImage(sprite, charId) {
  const url = spriteUrl(sprite, charId);
  if (!url) return null;
  let im = images[url];
  if (!im || (im.failed && im.attempts < 3 && Date.now() >= im.retryAt)) {
    const attempts = (im?.attempts || 0) + 1;
    im = images[url] = new Image();
    im.attempts = attempts;
    im.onload = () => console.log('[sprites] PNG charge', url, im.naturalWidth + 'x' + im.naturalHeight);
    im.onerror = () => { im.failed = true; im.retryAt = Date.now() + 3000; if (isImage(sprite)) console.warn('[sprites] PNG introuvable', url, '-> crane genere'); };
    im.src = url;
  }
  return im.complete && im.naturalWidth && !im.failed ? im : null;
}

function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function draw(id) {
  const look = LOOKS[id] || { skin: '#e8e2cf', hair: null, glasses: false };
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  // crâne
  rect(g, 4, 2, 8, 1, look.skin); rect(g, 3, 3, 10, 7, look.skin); rect(g, 4, 10, 8, 2, look.skin);
  rect(g, 5, 12, 6, 2, look.skin);
  // mâchoire / dents
  for (let x = 5; x < 11; x += 2) px(g, x, 13, '#222');
  // orbites
  rect(g, 4, 6, 3, 3, '#1a1a1a'); rect(g, 9, 6, 3, 3, '#1a1a1a');
  px(g, 5, 7, '#ff3b3b'); px(g, 10, 7, '#ff3b3b');
  // nez
  px(g, 7, 10, '#1a1a1a'); px(g, 8, 10, '#1a1a1a');
  if (look.hairStyle === 'swoop') {
    rect(g, 2, 1, 12, 2, look.hair); rect(g, 2, 3, 3, 3, look.hair); rect(g, 11, 3, 3, 2, look.hair);
    rect(g, 1, 2, 2, 2, look.hair); px(g, 13, 1, '#ffd27a'); px(g, 6, 1, '#ffd27a');
  } else if (look.hairStyle === 'thin') {
    rect(g, 3, 2, 2, 3, look.hair); rect(g, 11, 2, 2, 3, look.hair); rect(g, 5, 1, 6, 1, look.hair);
  }
  if (look.glasses) {
    rect(g, 3, 6, 4, 3, '#2b2b2b'); rect(g, 9, 6, 4, 3, '#2b2b2b'); rect(g, 7, 6, 2, 1, '#c9a24a');
    px(g, 4, 6, '#8fb3c9'); px(g, 10, 6, '#8fb3c9');
  }
  return c;
}
export function getSprite(id) {
  try {
    if (!cache[id]) cache[id] = draw(id);
    return cache[id];
  } catch (e) { return null; }
}
