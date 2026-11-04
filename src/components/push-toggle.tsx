"use client";

import { useEffect, useState } from "react";
import { b64urlDecode } from "@/lib/b64";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await registerSW();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await registerSW();
      if (!reg) return;
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlDecode(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      setState("on");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  if (state === "loading") return null;
  if (compact && state === "on") return null;

  return (
    <div className={compact ? "card border-primary/30 bg-accent/50" : ""}>
      {state === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          Bu tarayıcı bildirimleri desteklemiyor. iPhone&apos;da önce Paylaş → <b>Ana Ekrana Ekle</b> ile uygulamayı yükleyin, oradan açın.
        </p>
      )}
      {state === "denied" && <p className="text-sm text-destructive">Bildirim izni engellenmiş. Tarayıcı ayarlarından bu site için bildirimlere izin verin.</p>}
      {state === "off" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">🔔 Hatırlatma ve geri sayım bildirimlerini aç</p>
          <button className="btn-primary btn-sm" onClick={enable} disabled={busy}>
            Aç
          </button>
        </div>
      )}
      {state === "on" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-emerald-600">🔔 Bu cihazda bildirimler açık</p>
          <button className="btn-ghost btn-sm" onClick={disable} disabled={busy}>
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}
