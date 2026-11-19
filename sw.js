/* Static asset caching for offline use. Background push is intentionally not enabled in V1. */
const CACHE_NAME = 'water-reminder-static-v2-rose';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./logic.js','./i18n.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('water-reminder-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const app = await caches.match('./index.html');
        if (app) return app;
      }
      return new Response('Offline and not cached', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
