/* Harunbe Idle — Service Worker
   HTML: network-first so players always get the latest game code,
   falling back to cache when offline.
   Static assets (sprites, icons, manifest): cache-first with background
   revalidation — they're fingerprint-free, so this keeps loads instant.
   Bump CACHE_NAME to force clients to drop the old cache entirely.
*/
const CACHE_NAME = 'harunbe-idle-v2';
const ASSETS = [
  './',
  './index.html',
  './harunbe_idle.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* ── Install: pre-cache the game shell ───────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll rejects wholesale if any single asset 404s; cache one-by-one
      .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ─────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
         new URL(request.url).pathname.endsWith('.html') ||
         (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (isHtmlRequest(event.request)) {
    // Network-first: fresh game code wins; cache is the offline fallback
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then(c => c || caches.match('./harunbe_idle.html'))
      )
    );
    return;
  }

  // Static assets: cache-first, revalidate in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetched = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
