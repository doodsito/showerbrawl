import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Same release id in both entry points and every public sprite URL.
function releaseHash() {
  const hash = createHash('sha256');
  function visit(dir) {
    for (const entry of readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (entry.name === 'dist') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else hash.update(path).update(readFileSync(path));
    }
  }
  visit('client'); visit('shared');
  return hash.digest('hex').slice(0, 16);
}
const clientVersion = releaseHash();

export default defineConfig({
  root: 'client',
  define: { __CLIENT_VERSION__: JSON.stringify(clientVersion) },
  plugins: [{name:'client-version', generateBundle() {
    this.emitFile({type:'asset', fileName:'build-version.json', source:JSON.stringify({version:clientVersion})});
  }}],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./client/index.html', import.meta.url)),
        play: fileURLToPath(new URL('./client/play/index.html', import.meta.url)),
      },
    },
  },
  server: {
    host: true,
    fs: { allow: ['..'] },
    // Dev: les clients font io() sur 5173, Vite relaie vers le serveur node (3000).
    proxy: {
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true, changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
});
