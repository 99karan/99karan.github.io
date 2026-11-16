import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps the build portable: it works for a user site
// (username.github.io) and for a project site (username.github.io/repo) alike.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      // Two pages: the portfolio and a standalone, printable resume.
      input: {
        main: 'index.html',
        resume: 'resume.html',
      },
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          post: ['postprocessing', '@react-three/postprocessing'],
          gsap: ['gsap'],
          // Rapier ships its WASM inlined (~1.4 MB); keep it in its own long-lived chunk.
          physics: ['@react-three/rapier', '@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
