/* EvrythingPDF service worker — offline app shell.
   HTML: network-first (so deploys aren't stale). Static assets, self-hosted
   fonts and the unpkg PDF libraries: cache-first with runtime update. */
const V = 'epdf-v1';
const CORE = ['/', '/edit-text.html', '/add-text.html', '/editor.js', '/style.css', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)).catch(() => {}); return res; })
        .catch(() => caches.match(req).then(h => h || caches.match('/edit-text.html')))
    );
    return;
  }
  if (url.origin === location.origin || url.host === 'unpkg.com') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const c = res.clone(); caches.open(V).then(x => x.put(req, c)).catch(() => {}); return res;
      }))
    );
  }
});
