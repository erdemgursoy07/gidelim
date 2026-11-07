// Gidelim – uygulamayı telefonda saklayan katman (servis çalışanı)
// Sayfa: önce internetten en güncel hali (1.5 sn bekler), olmazsa saklanan hali → hızlı ve internetsiz açılış
// Simgeler ve yazı tipleri: saklanandan anında
const V = "gidelim-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== "gidelim-fonts").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  // Yapay zeka ve konum servisleri her zaman canlı
  if (u.hostname.endsWith("workers.dev") || u.hostname.includes("nominatim")) return;
  // Yazı tipleri: saklanandan
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("gidelim-fonts").then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const r = await fetch(req); if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r;
    }));
    return;
  }
  if (u.origin !== location.origin) return;
  // Sayfanın kendisi: önce güncel, gecikirse saklanan
  if (req.mode === "navigate" || u.pathname.endsWith(".html") || u.pathname.endsWith("/")) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      const cached = await c.match(req, { ignoreSearch: true }) || await c.match("./index.html");
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
      if (!cached) return net;
      const timer = new Promise(res => setTimeout(() => res(cached), 1500));
      try { return await Promise.race([net, timer]); } catch { return cached; }
    })());
    return;
  }
  // Diğer dosyalar: saklanandan, arkada güncelle
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
