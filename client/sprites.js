// Crânes politiciens en pixel art générés au runtime (aucune image).
const S = 16;
const cache = {};
const LOOKS = {
  trump: { skin: '#f2a25c', hair: '#ffb52e', hairStyle: 'swoop', glasses: false },
  biden: { skin: '#f1d2b8', hair: '#f4f4f4', hairStyle: 'thin', glasses: true },
};
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
