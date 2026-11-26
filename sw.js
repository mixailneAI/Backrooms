const CACHE = "br-9b24a71abe";
const PRECACHE = ["./","./index.html","./manifest.webmanifest","./core/colors.js","./core/events.js","./core/math.js","./core/prng.js","./core/storage.js","./core/time.js","./engine/camera.js","./engine/input.js","./engine/interact.js","./engine/loop.js","./engine/physics.js","./engine/save.js","./world/manual.js","./world/textures.js","./ui/terminal.css","./ui/terminal.js","./levels/all.js","./sw.js","./vendor/three.module.js","./assets/icon-192.png","./assets/icon-512.png","./assets/maskable-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf("br-") === 0 && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const fresh = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/ai/genome.js");
  if (fresh) { e.respondWith(fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))); return; }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; })));
});
