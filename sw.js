/* Harunbe Idle — Service Worker
   Cache-first strategy: serve from cache instantly, fetch update in background.
   Bump CACHE_NAME to force clients to pick up a new version.
*/
const CACHE_NAME = 'harunbe-idle-v1';
const ASSETS = [
  './',
  './harunbe_idle.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* ── Install: pre-cache all game assets ─────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
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

/* ── Fetch: cache-first, fall back to network, fall back to shell ─────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache immediately; revalidate in background
        const revalidate = fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => {});
        return cached;
      }
      // Not in cache — try network, cache on success
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        return response;
      }).catch(() =>
        // Offline and not cached — return the game shell
        caches.match('./harunbe_idle.html')
      );
    })
  );
});
