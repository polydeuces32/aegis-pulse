import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Strict CSP is injected into the production build only (dev server needs inline HMR scripts).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'aegis-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: { external: ['@smartspectra/node-sdk', 'electron'] },
    },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    build: { rollupOptions: { external: ['electron'] } },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  renderer: {
    root: resolve('src/renderer'),
    base: './',
    plugins: [react(), cspPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
});
