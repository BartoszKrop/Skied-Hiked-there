const C = "sht-v245", SHELL = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "assets/app.91699e92c9.js", "assets/data.e758d3dd46.js", "assets/app.28c7cdfc56.css"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Cache najpierw (szybki start, działa offline), w tle odświeżenie z sieci na następne wejście.
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const key = r.mode === "navigate" ? "./" : r;
  e.respondWith(caches.open(C).then(c => c.match(key).then(m => {
    const net = fetch(r.url, {cache: "no-store"}).then(res => { if (res.ok) c.put(key, res.clone()); return res; });
    if (m) { e.waitUntil(net.catch(() => {})); return m; }
    return net.catch(() => c.match("./"));
  })));
});
