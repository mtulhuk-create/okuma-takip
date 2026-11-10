"use client";

import { BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { b64urlDecode } from "@/lib/b64";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

/** Bildirim aboneliği: hata olursa nedenini gösterir, açıkken deneme bildirimi gönderilebilir */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await registerSW();
        const sub = await reg?.pushManager.getSubscription();
        // İzin verilmiş ama abonelik sunucuda yoksa (yeni cihaz / silinmiş) yeniden kaydet
        if (sub) await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) }).catch(() => {});
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Sunucuda bildirim anahtarı (VAPID) tanımlı değil.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        if (perm !== "denied") setMsg({ ok: false, text: "İzin penceresi kapatıldı. Tekrar “Aç”a basıp “İzin ver”i seç." });
        return;
      }
      const reg = await registerSW();
      if (!reg) throw new Error("Servis çalışanı kaydedilemedi.");
      await navigator.serviceWorker.ready;
      const old = await reg.pushManager.getSubscription();
      const sub = old ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlDecode(key) }));
      const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error("Abonelik sunucuya kaydedilemedi.");
      setState("on");
      await test();
    } catch (e) {
      setMsg({ ok: false, text: `Bildirimler açılamadı: ${(e as Error).message || "bilinmeyen hata"}` });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setMsg(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Deneme bildirimi gönderildi. Butonlarla uygulamayı açmadan bildirebilirsin." } : { ok: false, text: data.error ?? "Deneme bildirimi gönderilemedi." });
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
    <div className={`space-y-2 ${compact ? "card border-primary/30 bg-primary/5" : ""}`}>
      {state === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          Bu tarayıcı bildirimleri desteklemiyor. Uygulama içi tarayıcıdaysan (WhatsApp, Instagram…) siteyi Chrome&apos;da aç. iPhone&apos;da Paylaş → <b>Ana Ekrana Ekle</b> ile yükleyip oradan aç.
        </p>
      )}
      {state === "denied" && (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <BellOff className="size-4 shrink-0" /> Bildirim izni engellenmiş
          </p>
          <p className="text-xs text-muted-foreground">
            Android Chrome: adres çubuğundaki kilit/ayar simgesi → <b>İzinler</b> → <b>Bildirimler</b> → İzin ver. Ana ekrana eklediysen: telefon Ayarlar → Uygulamalar → Okuma Takip → Bildirimler. Sonra sayfayı yenile.
          </p>
        </div>
      )}
      {state === "off" && (
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <BellRing className="size-4 shrink-0 text-primary" /> Gün kartı, hatırlatma ve grup mesajı bildirimlerini aç
          </p>
          <button className="btn-primary btn-sm" onClick={enable} disabled={busy}>
            {busy ? "Açılıyor…" : "Aç"}
          </button>
        </div>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-emerald-600">
            <BellRing className="size-4" /> Bu cihazda bildirimler açık
          </p>
          <div className="flex gap-1.5">
            <button className="btn-ghost btn-sm" onClick={test} disabled={busy}>
              Deneme gönder
            </button>
            <button className="btn-quiet btn-sm" onClick={disable} disabled={busy}>
              Kapat
            </button>
          </div>
        </div>
      )}
      {msg && <p className={`text-xs font-medium ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
