import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { serviceWorker } from './vite-plugin-sw.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Relative asset URLs: the build is a static bundle that works from any
  // path — a domain root, a GitHub Pages /<repo>/ subpath, or a local folder.
  base: './',
  plugins: [react(), serviceWorker()],
  // One bundle (app + SQLite glue) is expected — it's precached for offline use.
  build: { chunkSizeWarningLimit: 1000 },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    // shared/ (progression algorithm) lives one level above the client root.
    fs: { allow: ['..'] },
  },
});
