/* ═══════════════════════════════════════════════════════
   CECB Plus — Service Worker
   Cache assets statiques pour mode hors-ligne
   ═══════════════════════════════════════════════════════ */

var CACHE_NAME = 'cecb-plus-v10';
var ASSETS = [
    './',
    './accueil.html',
    './projet.html',
    './style.css',
    './eta-mise-en-page.css',
    './auth.js',
    './project-store.js',
    './api-handler.js',
    './recueil.js',
    './recueil-ui.js',
    './recueil-sections.js',
    './recueil-pdf.js',
    './recueil-transcript.js',
    './photos.js',
    './variantes.js',
    './textes.js',
    './relecture.js',
    './assets/eta-consult-logo-small.jpeg',
    './assets/eta-consult-logo.jpeg'
];

// Static asset extensions we cache (whitelist approach)
var STATIC_ASSET_RE = /\.(html|js|css|json|png|jpg|jpeg|svg|ico|woff2?|ttf|webp)$/i;

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

// Fetch: network first, fallback to cache.
// Whitelist: only same-origin static assets are cached. Anything else
// (cross-origin, API calls to the proxy, dynamic POSTs) bypasses the SW
// entirely so we never cache a response that might contain user data.
self.addEventListener('fetch', function (e) {
    if (e.request.method !== 'GET') return;

    var url = new URL(e.request.url);
    var sameOrigin = url.origin === self.location.origin;
    var isRoot = url.pathname === '/' || url.pathname.endsWith('/');
    var isStaticAsset = STATIC_ASSET_RE.test(url.pathname);

    if (!sameOrigin || (!isRoot && !isStaticAsset)) {
        return; // Let the browser handle it without SW intervention
    }

    e.respondWith(
        fetch(e.request).then(function (resp) {
            if (resp.ok) {
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
