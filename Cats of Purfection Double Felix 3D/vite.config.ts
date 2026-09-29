import { defineConfig } from 'vite';

// Cats of Purfection Double Felix 3D
// - base './' so the built dist/ can be opened from any path or LAN share
// - host: true exposes the dev/preview server on the LAN (up to 6 players)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000
  },
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 4173
  }
});
