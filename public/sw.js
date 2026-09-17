const CACHE = "wazo-app-v5";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];
const SKIP_PREFIXES = ["/api/", "/boutique/", "/formation", "/suivi", "/trace"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function skipPath(pathname) {
  return SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isDocumentRequest(request) {
  if (request.mode === "navigate" || request.destination === "document") return true;
  try {
    const url = new URL(request.url);
    if (url.searchParams.has("_rsc")) return true;
  } catch {
    return false;
  }
  return request.headers.get("RSC") === "1";
}

function shouldCache(request, response) {
  if (!response || !response.ok) return false;
  if (response.type === "opaque" || response.type === "opaqueredirect") return false;
  if (isDocumentRequest(request)) return false;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("text/x-component")) {
    return false;
  }
  try {
    const url = new URL(response.url);
    if (url.origin !== self.location.origin) return false;
    if (url.pathname === "/sw.js" || url.pathname === "/manifest.json") return false;
    if (skipPath(url.pathname)) return false;
  } catch {
    return false;
  }
  return true;
}

function putInCache(request, response) {
  if (!shouldCache(request, response)) return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (skipPath(url.pathname)) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

  if (isDocumentRequest(request)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || Response.error();
      })
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            putInCache(request, response);
            return response;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        putInCache(request, response);
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return Response.error();
      })
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Wazo Digital", body: "", url: "/dashboard" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data?.text() || "";
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
