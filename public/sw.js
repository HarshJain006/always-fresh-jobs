/* DailyResume PWA — cache shell assets; network-first for pages/APIs */
const CACHE = "dailyresume-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/pwa-icon-192.png", "/pwa-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache auth/API/server-fn style paths
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("google-callback") ||
    request.headers.get("accept")?.includes("application/json")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok && (url.pathname.startsWith("/assets/") || PRECACHE.includes(url.pathname))) {
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
  );
});
