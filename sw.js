const CACHE_NAME = "dlm-cache-v1";
const CORE_ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

// পেজ থেকে পাঠানো মেসেজ শুনে নোটিফিকেশন দেখানো (mobile-এ সরাসরি new Notification() কাজ করে না,
// এই showNotification() পদ্ধতিটাই ব্যবহার করতে হয়)
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(data.title || "রিমাইন্ডার", {
      body: data.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      if (clientsArr.length > 0) return clientsArr[0].focus();
      return self.clients.openWindow("./");
    })
  );
});
