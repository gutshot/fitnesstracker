// Service worker template — vite-plugin-sw.js fills in the version and the
// precache list at build time. Not bundled with the app.
const VERSION = '75cc5de5d2e6';
const ASSETS  = [
  "./",
  "apple-touch-icon.png",
  "assets/index-CYhpbNy-.js",
  "assets/sql-wasm-browser-DfANybxk.wasm",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest"
];
const CACHE   = `fitnesstrack-${VERSION}`;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('fitnesstrack-') && k !== CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page asks a waiting worker to take over when the user accepts an update.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Cache-first for everything we precached; the app shell for any navigation
// (routing is hash-based, so every page is index.html).
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(new URL('./', self.registration.scope).href).then(r => r || fetch(request))
    );
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then(r => r || fetch(request)));
});
