// @ts-check
// Vite config — build experimental del frontend modularizado.
// Coexiste con ava.html monolítico (legacy). No lo reemplaza todavía.
//
// Uso:
//   npm i -D vite
//   npm run build:vite    → genera dist/ con el build optimizado
//   npm run dev:vite      → dev server con HMR en :5173 + proxy /api/* a :3333
//
// Cuando la migración esté completa:
//   1. mv ava.html ava-legacy.html
//   2. Apunta server.js a servir dist/index.html como default
//   3. Borra el ava.html monolítico

import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vrm: ['@pixiv/three-vrm'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});
