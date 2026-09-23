const CACHE_NAME = 'messa-shell-v1';

const APP_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

/* =========================
   TELEPÍTÉS
========================= */

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_ASSETS))
    );

    self.skipWaiting();
});


/* =========================
   AKTIVÁLÁS
========================= */

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );

    self.clients.claim();
});


/* =========================
   KÉRÉSEK KEZELÉSE
========================= */

self.addEventListener('fetch', event => {

    // Csak GET kéréseket kezelünk.
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    /*
     * Csak a Messa saját GitHub Pages
     * fájljait gyorsítótárazza.
     *
     * A Supabase API-t és más külső
     * szolgáltatásokat nem cache-eljük.
     */
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request);
            })
    );
});