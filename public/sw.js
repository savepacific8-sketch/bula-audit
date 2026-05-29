// BULA AUDIT service worker.
//
// Strategy:
//   - Static assets (built JS/CSS, fonts, logo, manifest):   cache-first
//   - HTML navigation:                                       network-first, fallback to cached shell
//   - /api requests:                                         never cached
//   - /uploads/* and signed receipt URLs:                    stale-while-revalidate (one week)
//
// Cache version is bumped on each release; old caches purged on activate.

const VERSION = 'bula-v1';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const IMAGES_CACHE = `${VERSION}-images`;

const APP_SHELL = ['/', '/manifest.webmanifest', '/bula-logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}
function isUploadRequest(url) {
  return url.pathname.startsWith('/uploads/') || /\.(?:jpg|jpeg|png|webp|pdf)$/i.test(url.pathname);
}
function isStaticAsset(url) {
  return /\.(?:js|mjs|css|woff2?|ttf|svg|ico|png|webp)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/uploads/')) return;

  if (isApiRequest(url)) return; // never cache API

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (isUploadRequest(url)) {
    event.respondWith(staleWhileRevalidate(req, IMAGES_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    const shell = await caches.match('/');
    if (shell) return shell;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(cacheName);
    cache.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
