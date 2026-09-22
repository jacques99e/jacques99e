// wazo-app-v9: network-only navigations. Never cache HTML/RSC — that crashed the Android icon.

const OFFLINE = "/offline.html";
const PRECACHE = "wazo-offline-v9";

function safePushPath(url) {
  if (typeof url !== "string") return "/dashboard";
  const text = url.trim();
  if (!text.startsWith("/") || text.startsWith("//") || text.includes("://") || text.includes("\\")) {
    return "/dashboard";
  }
  return text.slice(0, 200);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.add(OFFLINE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== PRECACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isDocument = req.mode === "navigate" || req.destination === "document";
  const isRsc = url.searchParams.has("_rsc") || req.headers.get("RSC") === "1";
  if (!isDocument && !isRsc) return;

  event.respondWith(
    fetch(req).catch(async () => {
      const cached = await caches.match(OFFLINE);
      return cached || Response.error();
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
      data: { url: safePushPath(data.url) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safePushPath(event.notification.data?.url);
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
