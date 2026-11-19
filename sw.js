/* Offline app shell + user-visible Web Push notifications (requires a configured sender). */
const CACHE_NAME = 'water-reminder-static-v14-all-screens-motion';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./motion.js','./daily-slogans.js','./logic.js','./i18n.js','./journal-ui.js','./week-strip.js','./hydration-insights.js','./solo.js','./push-config.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-maskable.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('water-reminder-') && k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
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
        const page = await caches.match('./index.html');
        if (page) return page;
      }
      return new Response('Offline and not cached', { status: 503 });
    }
  })());
});
self.addEventListener('push', event => {
  const fallback = { title: 'Water ♡', body: 'Bé ơi, tới giờ uống nước rồi nè ♡' };
  let payload = fallback;
  try { payload = { ...fallback, ...(event.data ? event.data.json() : {}) }; }
  catch { /* keep the friendly fallback */ }
  event.waitUntil(self.registration.showNotification(String(payload.title || fallback.title).slice(0, 70), {
    body: String(payload.body || fallback.body).slice(0, 160),
    icon: './assets/icon.svg',
    badge: './assets/icon.svg',
    tag: 'water-reminder',
    renotify: false,
    data: { url: new URL('./', self.registration.scope).href }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL('./', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = all.find(client => client.url.startsWith(target));
    if (existing) return existing.focus();
    if (clients.openWindow) return clients.openWindow(target);
  })());
});