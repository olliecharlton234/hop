/* HOP service worker — kept deliberately simple for a fast-moving beta.
   - The app page is network-first: every open fetches the latest deploy; the cached copy is
     only used offline. So testers never get stuck on an old version.
   - Content-hashed bundles (/_expo/static, /assets) and static fonts/icons are cache-first.
   - Each deploy has a new BUILD id, which clears the previous caches.
   - Map tiles, photos and analytics are never cached here. */
const BUILD = '__BUILD_ID__';
const SHELL = `hop-shell-${BUILD}`;
const STATIC = `hop-static-${BUILD}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add('/')).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, STATIC]);
    for (const k of await caches.keys()) if (k.startsWith('hop-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isStatic = (p) => p.startsWith('/_expo/static/') || p.startsWith('/assets/') || p.startsWith('/fonts/') || p.startsWith('/icons/') || p.startsWith('/splash/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/', { cacheName: SHELL })) || Response.error();
      }
    })());
    return;
  }

  if (isStatic(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { cacheName: STATIC });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
      return res;
    })());
  }
});
