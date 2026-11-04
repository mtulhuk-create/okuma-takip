"use client";

// APK içinde (Capacitor) çalışırken: okuma günlerini cihazda yerel bildirim olarak planlar,
// bildirimdeki hızlı butonları işler ve Android geri tuşunu yönetir.
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Schedule = {
  groups: {
    groupId: string;
    name: string;
    dailyPages: number;
    reminderHours: number;
    eligibleFrom: string;
    periods: { dayKey: string; start: string; deadline: string; reported: boolean; token: string }[];
  }[];
};

const COUNTDOWN_MINUTES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function hhmm(d: Date) {
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

async function syncSchedule() {
  const res = await fetch("/api/me/schedule", { cache: "no-store" });
  if (!res.ok) return;
  const data = (await res.json()) as Schedule;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });

  const now = Date.now();
  const list: LocalNotificationSchema[] = [];
  let id = 1000;
  for (const g of data.groups) {
    for (const p of g.periods) {
      if (p.reported) continue;
      const start = new Date(p.start).getTime();
      const deadline = new Date(p.deadline);
      if (new Date(g.eligibleFrom).getTime() > start) continue;
      const extra = { token: p.token, groupId: g.groupId };
      const remindAt = deadline.getTime() - g.reminderHours * 3_600_000;
      if (g.reminderHours > 0 && remindAt > now && remindAt >= start) {
        list.push({
          id: id++,
          title: `📚 ${g.name}: okuma hatırlatması`,
          body: `Bugünkü ${g.dailyPages} sayfanı henüz bildirmedin. Son bildirim saati ${hhmm(deadline)}.`,
          schedule: { at: new Date(remindAt), allowWhileIdle: true },
          actionTypeId: "REPORT",
          channelId: "reminders",
          extra,
        });
      }
      for (const m of COUNTDOWN_MINUTES) {
        const at = deadline.getTime() - m * 60_000;
        if (at <= now) continue;
        list.push({
          id: id++,
          title: `⏳ ${m} dakika kaldı · ${g.name}`,
          body: `Son bildirim ${hhmm(deadline)}. Okuduysan hemen bildir, yoksa ceza yazılacak!`,
          schedule: { at: new Date(at), allowWhileIdle: true },
          actionTypeId: "REPORT",
          channelId: "countdown",
          extra,
        });
      }
    }
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list });
}

export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const [exactDenied, setExactDenied] = useState(false);
  const ready = useRef(false);

  const sync = useCallback(() => {
    if (ready.current) syncSchedule().catch(() => {});
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const subs: Promise<{ remove: () => Promise<void> }>[] = [];
    (async () => {
      await LocalNotifications.requestPermissions();
      try {
        const exact = await LocalNotifications.checkExactNotificationSetting();
        setExactDenied(exact.exact_alarm !== "granted");
      } catch {}
      await LocalNotifications.createChannel({ id: "reminders", name: "Okuma hatırlatmaları", importance: 4, vibration: true });
      await LocalNotifications.createChannel({ id: "countdown", name: "Son 10 dakika geri sayımı", importance: 5, vibration: true });
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: "REPORT",
            actions: [
              { id: "pages", title: "📖 Okudum", input: true, inputPlaceholder: "Kaç sayfa?", inputButtonTitle: "Gönder" },
              { id: "min", title: "✅ Alt sınırı okudum" },
              { id: "none", title: "❌ Okumadım", destructive: true },
            ],
          },
        ],
      });
      ready.current = true;
      await syncSchedule().catch(() => {});
    })();

    subs.push(
      LocalNotifications.addListener("localNotificationActionPerformed", async (ev) => {
        const extra = ev.notification.extra as { token?: string; groupId?: string } | undefined;
        if (!extra?.token) return;
        if (ev.actionId === "tap") {
          router.push(`/bildir/${extra.groupId}?t=${encodeURIComponent(extra.token)}`);
          return;
        }
        const res = await fetch("/api/quick-report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: extra.token, choice: ev.actionId, pages: ev.inputValue ? Number(ev.inputValue) : undefined }),
        });
        const data = await res.json().catch(() => ({}));
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1,
              title: res.ok ? "Bildirim kaydedildi ✓" : "Bildirilemedi",
              body: res.ok ? `${data.pages} sayfa bildirildi.` : data.error ?? "Uygulamayı açıp tekrar deneyin.",
              channelId: "reminders",
            },
          ],
        });
        await syncSchedule().catch(() => {});
        router.refresh();
      }),
    );
    subs.push(App.addListener("resume", () => sync()));
    subs.push(
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      }),
    );
    return () => {
      subs.forEach((s) => s.then((h) => h.remove()));
    };
  }, [router, sync]);

  // Sayfa değiştikçe (örn. okuma bildirildikten sonra) planı tazele
  useEffect(() => {
    const t = setTimeout(sync, 1500);
    return () => clearTimeout(t);
  }, [pathname, sync]);

  if (!exactDenied) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-50 rounded-xl bg-amber-100 p-3 text-sm text-amber-900 shadow-lg">
      Geri sayım bildirimlerinin tam zamanında gelmesi için izin verin.
      <button
        className="ml-2 font-bold underline"
        onClick={async () => {
          await LocalNotifications.changeExactNotificationSetting();
          const exact = await LocalNotifications.checkExactNotificationSetting();
          setExactDenied(exact.exact_alarm !== "granted");
        }}
      >
        İzin ver
      </button>
    </div>
  );
}
