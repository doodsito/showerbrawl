// Taille de rendu d'un perso, lue dans sa config (characters.json). Sans DOM: testable en Node.
// fullBody + PNG charge => rendu en pied (76), PNG simple => format tete (51), sans PNG => crane genere.
export const FULL_BODY_H = 76, HEAD_H = 51;
export function spriteLayout(cfg, hasImage) {
  const full = !!hasImage && !!cfg?.fullBody;
  return { full, h: full ? FULL_BODY_H : HEAD_H, skull: !hasImage };
}
