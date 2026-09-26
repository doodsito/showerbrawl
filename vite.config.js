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
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
