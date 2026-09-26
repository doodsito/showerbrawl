import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'client',
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
