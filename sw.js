// Bump this version string every time you want to force old caches to clear.
// (You don't actually need to bump it manually — this file already auto-updates.)
const CACHE_VERSION = "v3";
const CACHE_NAME = "daily-task-" + CACHE_VERSION;

// Only static, rarely-changing assets go in the cache. The HTML itself is
// always fetched fresh from the network first (see fetch handler below).
const STATIC_ASSETS = [
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-192-maskable.png",
  "icon-512-maskable.png",
];

// The URL to open/focus when a notification is clicked.
const APP_SHELL_URL = "./";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  // Activate the new service worker as soon as it finishes installing,
  // instead of waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // Take control of any already-open tabs immediately.
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isHTML = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");

  if (isHTML) {
    // Network-first: always try to get the latest index.html when online.
    // Falls back to whatever's cached only if there's no internet.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets: cache-first for speed, but refresh the cache in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ---- Backend থেকে আসা push message দেখানোর হ্যান্ডলার ----
self.addEventListener("push", (event) => {
  let data = { title: "দৈনিক আমল", body: "", tag: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body,
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: data.tag,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ---- নোটিফিকেশনে ক্লিক করলে অ্যাপ খোলা/ফোকাস করার হ্যান্ডলার ----
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // অ্যাপ আগে থেকে কোনো ট্যাবে খোলা থাকলে সেটাকেই ফোকাস করে দাও
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const scopeUrl = new URL(self.registration.scope);
          if (clientUrl.origin === scopeUrl.origin) {
            await client.focus();
            if (client.navigate) {
              try { await client.navigate(APP_SHELL_URL); } catch (e) {}
            }
            return;
          }
        } catch (e) {}
      }

      // কোনো ট্যাব খোলা না থাকলে নতুন উইন্ডো/ট্যাবে অ্যাপ খোলো
      if (self.clients.openWindow) {
        await self.clients.openWindow(APP_SHELL_URL);
      }
    })()
  );
});

self.addEventListener("notificationclose", (event) => {
  // no-op
});
