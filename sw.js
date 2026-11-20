const CACHE_NAME = 'water-reminder-static-v19-receiver';
const APP_ROOT = new URL('./', self.registration.scope);
const API_URL = 'https://water-beo-push.hungdeniubeo-water.workers.dev';
const ASSETS = [
  './', './index.html', './receiver.css', './receiver.js',
  './classic-pink-button.css', './classic-pink-button.js', './push-config.js',
  './manifest.webmanifest', './assets/icon.svg', './assets/icon-maskable.svg'
];
const assetPaths = new Set(ASSETS.map(path => new URL(path, APP_ROOT).pathname));
const validMessageId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('water-reminder-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  // Only the receiving app shell is cached. Admin, API data and credentials stay out.
  if (request.method !== 'GET' || url.origin !== APP_ROOT.origin || !assetPaths.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = new URL(url.pathname, APP_ROOT).href;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') await cache.put(cacheKey, response.clone());
      return response;
    } catch {
      const cached = await cache.match(cacheKey, {ignoreSearch:true});
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const home = await cache.match(new URL('./index.html', APP_ROOT).href);
        if (home) return home;
      }
      return new Response('Chưa có kết nối mạng. Thử lại khi có mạng nhé.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});

async function receipt(data, event) {
  if (!validMessageId(data?.id) || typeof data.receiptToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.receiptToken)) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(API_URL + '/api/receipts', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit',
      body:JSON.stringify({id:data.id, token:data.receiptToken, event}), signal:controller.signal
    });
  } catch { /* An unavailable receipt must never suppress a visible notification. */ }
  finally { clearTimeout(timeout); }
}
async function tellApp(type, id) {
  try {
    const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin === APP_ROOT.origin && (url.pathname === APP_ROOT.pathname || url.pathname === new URL('./index.html', APP_ROOT).pathname)) {
        client.postMessage({type, id});
      }
    }
  } catch { /* The receiving app may be closed. */ }
}
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch {}
    const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.slice(0,70) : 'Water ♡';
    const body = typeof payload.body === 'string' && payload.body.trim() ? payload.body.slice(0,150) : 'Beo ơi, nhớ uống chút nước nha em ♡';
    const id = validMessageId(payload.id) ? payload.id : null;
    const data = {id, receiptToken:payload.receiptToken};
    // iOS requires visible notifications; network work happens only after this.
    await self.registration.showNotification(title, {
      body, icon:new URL('./assets/icon.svg', APP_ROOT).href,
      badge:new URL('./assets/icon.svg', APP_ROOT).href,
      tag:'water-' + (id || crypto.randomUUID()), data
    });
    await Promise.allSettled([receipt(data, 'received'), tellApp('PUSH_RECEIVED', id)]);
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    const url = new URL(APP_ROOT);
    if (validMessageId(data.id)) url.searchParams.set('message', data.id);
    const open = async () => {
      const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      const client = windows.find(window => {
        const existing = new URL(window.url);
        return existing.origin === APP_ROOT.origin && (existing.pathname === APP_ROOT.pathname || existing.pathname === new URL('./index.html', APP_ROOT).pathname);
      });
      if (client) {
        await client.focus();
        client.postMessage({type:'NOTIFICATION_OPENED', id:validMessageId(data.id) ? data.id : null});
      } else await self.clients.openWindow(url.href);
    };
    await Promise.allSettled([receipt(data, 'opened'), open()]);
  })());
});
