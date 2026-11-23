/* OMNI web — offline service worker. The app is cached on install; vision engines and fonts are cached the first time they're used. */
const VERSION = 'omni-web-55a55c20a3';
const ENGINES = 'omni-engines-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/core.js', 'js/parser.js', 'js/actions.js', 'js/voice.js', 'js/camera.js', 'js/vision.js', 'js/scanner.js', 'js/gesture.js',
  'js/spatial.js', 'js/automation.js', 'js/workshop.js', 'js/control.js', 'js/discover.js', 'js/settings.js', 'js/boot.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-64.png'];
const ENGINE_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'storage.googleapis.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== ENGINES) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (ENGINE_HOSTS.includes(url.hostname)) {
    // Pinned library versions and models never change: cache first.
    e.respondWith((async () => {
      const c = await caches.open(ENGINES);
      const hit = await c.match(req, { ignoreVary: true });
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone()).catch(() => {});
      return r;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    if (req.mode === 'navigate') {
      const hit = await c.match('index.html');
      if (hit) { e.waitUntil(fetch(req).then(r => r.ok && c.put('index.html', r.clone())).catch(() => {})); return hit; }
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) { return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
  })());
});
