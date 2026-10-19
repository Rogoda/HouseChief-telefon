// Service worker: strona działa offline (np. w sklepie bez zasięgu).
// Pliki aplikacji z cache, data.json najpierw z sieci, a gdy nie ma sieci, z cache.
const CACHE = 'housechief-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.json', './icon.svg', './data.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('data.json')) {
    e.respondWith(fetch(e.request).then((r) => { caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { caches.open(CACHE).then((c) => c.put(e.request, res.clone())); return res; })));
  }
});
