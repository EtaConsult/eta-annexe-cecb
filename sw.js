/* ═══════════════════════════════════════════════════════
   CECB Plus — Service Worker
   Cache assets statiques pour mode hors-ligne
   ═══════════════════════════════════════════════════════ */

var CACHE_NAME = 'cecb-plus-v2';
var ASSETS = [
    './',
    './accueil.html',
    './projet.html',
    './style.css',
    './auth.js',
    './project-store.js',
    './api-handler.js',
    './recueil.js',
    './photos.js',
    './variantes.js',
    './textes.js'
];

// Install: cache static assets
self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== CACHE_NAME; })
                    .map(function (k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', function (e) {
    var url = new URL(e.request.url);

    // Don't cache API calls
    if (url.hostname === 'api.anthropic.com' ||
        url.hostname === 'api.groq.com' ||
        url.hostname.endsWith('geo.admin.ch') ||
        url.hostname === 'cdn.jsdelivr.net' ||
        url.hostname === 'cdnjs.cloudflare.com') {
        return;
    }

    e.respondWith(
        fetch(e.request).then(function (resp) {
            // Update cache with fresh response
            if (resp.ok && e.request.method === 'GET') {
                var clone = resp.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(e.request, clone);
                });
            }
            return resp;
        }).catch(function () {
            // Offline: serve from cache
            return caches.match(e.request);
        })
    );
});
