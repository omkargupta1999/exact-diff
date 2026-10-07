/* Exact Diff service worker — makes the hosted web app work offline after the first visit.
 * The cache name and asset list below are filled in by scripts/build-web.mjs; the cache name
 * contains a content hash, so every release replaces the old cache automatically. */
'use strict';
const CACHE = '__CACHE__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('exact-diff-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first for this app's own files; nothing else is ever requested.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
