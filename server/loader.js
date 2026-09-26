import { readFileSync } from 'node:fs';
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
export const arena = loadArena();
