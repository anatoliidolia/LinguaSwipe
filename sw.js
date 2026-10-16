// LinguaSwipe service worker: lets the app open fast and offline.
// Supabase requests (login, words) are never cached — they always go to the network.

const CACHE = 'linguaswipe-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png'
];
const CDN_HOSTS = [
    'cdn.tailwindcss.com',
    'unpkg.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Own pages: network first so updates arrive immediately, cache as offline fallback
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request, { ignoreSearch: true })
                    .then(cached => cached || caches.match('./index.html')))
        );
        return;
    }

    // Libraries and fonts from CDNs: cache first (their URLs are versioned)
    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(
            caches.match(request).then(cached => cached || fetch(request).then(response => {
                if (response.ok || response.type === 'opaque') {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                }
                return response;
            }))
        );
    }
    // Everything else (Supabase API) goes straight to the network.
});
