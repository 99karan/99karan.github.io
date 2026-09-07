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
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          post: ['postprocessing', '@react-three/postprocessing'],
          gsap: ['gsap'],
        },
      },
    },
  },
});
