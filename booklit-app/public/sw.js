/* Booklit service worker: offline app shell, cached assets, and "Share to Booklit" for PDFs. */
const VERSION = 'booklit-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'booklit-shared').map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Files shared to the installed app (Android share sheet / "Open with"): keep the file, open the app.
  if (e.request.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith(
      (async () => {
        const form = await e.request.formData();
        const file = form.get('file');
        if (file && typeof file !== 'string') {
          const cache = await caches.open('booklit-shared');
          await cache.put('/shared-file', new Response(file, { headers: { 'Content-Type': file.type || 'application/pdf', 'X-File-Name': encodeURIComponent(file.name || 'shared.pdf') } }));
        }
        return Response.redirect('/import?shared=1', 303);
      })(),
    );
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Hashed build files and icons never change: cache first.
  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network first, fall back to the cached app when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(VERSION).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/')),
    );
  }
});
