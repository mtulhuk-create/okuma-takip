// Okuma Takip servis worker'ı: push bildirimleri ve hızlı bildirim butonları
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Okuma Takip", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Okuma Takip", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: !!data.renotify && !!data.tag,
      requireInteraction: !!data.token,
      vibrate: [200, 100, 200],
      // Tarayıcının izin verdiği kadar buton (çoğu Android/Chrome'da 2-3)
      actions: (data.actions || []).slice(0, Math.max(0, (self.Notification && Notification.maxActions) || 2)),
      data: { url: data.url || "/panel", token: data.token },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const { url, token } = n.data || {};
  n.close();
  if (["all", "min", "none"].includes(event.action) && token) {
    event.waitUntil(
      fetch("/api/quick-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, choice: event.action }),
      })
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) =>
          self.registration.showNotification(ok ? "Bildirim kaydedildi ✓" : "Bildirilemedi", {
            body: ok ? `${j.pages} sayfa bildirildi.` : j.error || "Uygulamayı açıp tekrar deneyin.",
            icon: "/icons/icon-192.png",
            tag: n.tag,
          }),
        ),
    );
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
