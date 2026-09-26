import { readFileSync, watchFile } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ABILITY_TYPES } from '../shared/protocol.js';

const read = (f) => JSON.parse(readFileSync(fileURLToPath(new URL(`../shared/${f}`, import.meta.url)), 'utf8'));
const SLOTS = ['attack', 'defense', 'super'];

function loadCharacters() {
  const raw = read('characters.json');
  const out = {};
  for (const [id, c] of Object.entries(raw)) {
    if (id.startsWith('_') || !c || typeof c !== 'object') continue;
    const ch = { id, name: c.name || id, hp: c.hp || 100, speed: c.speed || 200, sprite: c.sprite || id };
    for (const s of SLOTS) {
      const a = c[s];
      if (a && ABILITY_TYPES.includes(a.type)) ch[s] = { cooldown: 1, ...a };
      else { console.warn(`[loader] ${id}.${s}: type invalide "${a?.type}", ignore`); ch[s] = null; }
    }
    out[id] = ch;
  }
  return out;
}

function loadArena() {
  const a = read('arena.json');
  return { cellSize: a.cellSize || 64, grid: a.grid || [], spawns: a.spawns || {}, obstacles: a.obstacles || [], theme: a._schema?.theme };
}

export const characters = loadCharacters();

// Recharge characters.json a chaud (l'objet exporte est mis a jour sur place). Erreur de JSON => on garde l'ancien.
export function watchCharacters(onChange) {
  watchFile(fileURLToPath(new URL('../shared/characters.json', import.meta.url)), { interval: 1000 }, () => {
    try {
      const fresh = loadCharacters();
      for (const k of Object.keys(characters)) if (!(k in fresh)) delete characters[k];
      Object.assign(characters, fresh);
      console.log('[loader] characters.json recharge:', Object.keys(characters).length, 'persos');
      onChange?.();
    } catch (e) { console.warn('[loader] characters.json invalide, ancien garde:', e.message); }
  });
}
export const arena = loadArena();
