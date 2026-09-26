// Build du client partage entre fichiers de test lances en parallele par node --test:
// un seul processus construit (verrou mkdir atomique), les autres attendent la fin.
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = `${root}client/dist`;
const lock = `${root}node_modules/.sb-build-lock`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function ensureBuild() {
  for (let i = 0; i < 1200; i++) {
    let mine = false;
    try { mkdirSync(lock); mine = true; } catch {
      // verrou abandonne (process tue): on le libere apres 2 min
      try { if (Date.now() - statSync(lock).mtimeMs > 120000) rmSync(lock, { recursive: true, force: true }); } catch {}
    }
    if (mine) {
      try { if (!existsSync(`${dist}/index.html`)) execSync('npx vite build', { cwd: root, stdio: 'ignore' }); }
      finally { rmSync(lock, { recursive: true, force: true }); }
      return;
    }
    await wait(250);
  }
  throw new Error('build du client: verrou jamais libere');
}
