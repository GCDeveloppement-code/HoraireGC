/* Service worker minimal : rend l'appli installable et garde une page de secours hors ligne.
   Les données passent toujours par le réseau (jamais de cache sur les déclarations). */
const CACHE = "hsgc-v1";
const SHELL = ["/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Icônes et manifest : cache d'abord.
  if (SHELL.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copie = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copie));
      return res;
    })));
    return;
  }
  // Tout le reste : réseau, avec un message clair si on est hors ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            "<!doctype html><meta charset='utf-8'><title>Hors ligne</title><body style='font-family:system-ui;padding:40px;text-align:center;color:#1e2a3a;background:#d3e9f9'><h1>Pas de réseau</h1><p>Heures Sup a besoin d'une connexion pour enregistrer tes déclarations. Réessaie dans un instant.</p></body>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
      ),
    );
  }
});
