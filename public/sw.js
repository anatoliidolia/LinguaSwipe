// LinguaSwipe service worker: lets the app open fast and offline.
// Supabase requests (login, words) are never cached — they always go to the network.

// Обидва значення підставляє при збірці плагін у vite.config.js:
// версія змінюється з кожним деплоєм (старий кеш видаляється), список — зібрані JS/CSS з хешами.
const BUILD_VERSION = '__BUILD_VERSION__';
const BUILD_ASSETS = [/* __BUILD_ASSETS__ */];

const CACHE = 'linguaswipe-' + BUILD_VERSION;
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    ...BUILD_ASSETS
];
const CDN_HOSTS = [
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

function cacheFirst(request) {
    return caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok || response.type === 'opaque') {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
    }));
}

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        // Зібрані файли з хешем у назві (assets/index-a1b2c3.js) ніколи не змінюються
        if (url.pathname.includes('/assets/')) {
            event.respondWith(cacheFirst(request));
            return;
        }
        // Own pages: network first so updates arrive immediately, cache as offline fallback
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

    // Icons and fonts from CDNs: cache first (their URLs are versioned)
    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(request));
    }
    // Everything else (Supabase API) goes straight to the network.
});
