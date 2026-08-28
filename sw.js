/**
 * Cache-first service worker so the app keeps working with no network (T5).
 * Bump CACHE when the assets change; old caches are cleared on activate.
 */
const CACHE = 'conway-life-v1';
const ASSETS = [
  '.', 'index.html', 'manifest.webmanifest',
  'css/styles.css',
  'js/app.js', 'js/life.js', 'js/patterns.js', 'js/storage.js',
  'js/render.js', 'js/input.js', 'js/sound.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => { /* a partial cache is better than a failed install */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match('index.html')))
  );
});
