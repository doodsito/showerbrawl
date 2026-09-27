import {getImage} from './sprites.js';

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
