// Okuma günü hatırlatmaları ve son 10 dakika geri sayımı cihazda planlanır;
// böylece internet ya da push servisi olmadan da tam zamanında gelir.
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "./config";

export const REPORT_CATEGORY = "REPORT";
const COUNTDOWN_MINUTES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

type Schedule = {
  groups: {
    groupId: string;
    name: string;
    dailyPages: number;
    minPages?: number;
    books?: string[];
    reminderHours: number;
    eligibleFrom: string;
    periods: { dayKey: string; start: string; deadline: string; reported: boolean; token: string }[];
  }[];
};

export type ReportData = { token: string; groupId: string; dayKey: string; sticky?: boolean };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function hhmm(d: Date) {
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
}

export async function setupNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Okuma hatırlatmaları",
      // eslint-disable-next-line import/namespace -- enum `export *` ile geliyor, eklenti göremiyor
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
    // Kilit ekranında duran sabit "bugünün okuması" bildirimi
    await Notifications.setNotificationChannelAsync("today", {
      name: "Bugünün okuması (kilit ekranı)",
      description: "Okuma günü boyunca kilit ekranında duran gün kartı ve butonları",
      // eslint-disable-next-line import/namespace -- enum `export *` ile geliyor, eklenti göremiyor
      importance: Notifications.AndroidImportance.HIGH,
      // eslint-disable-next-line import/namespace -- enum `export *` ile geliyor, eklenti göremiyor
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 250, 150, 250],
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync("countdown", {
      name: "Son 10 dakika geri sayımı",
      // eslint-disable-next-line import/namespace -- enum `export *` ile geliyor, eklenti göremiyor
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200],
    });
  }
  // Android en fazla 3 buton gösterir: gün kartındaki temel seçenekler
  await Notifications.setNotificationCategoryAsync(REPORT_CATEGORY, [
    { identifier: "all", buttonTitle: "✅ Okudum", options: { opensAppToForeground: false } },
    { identifier: "min", buttonTitle: "☑️ Alt sınır", options: { opensAppToForeground: false } },
    { identifier: "none", buttonTitle: "❌ Okumadım", options: { opensAppToForeground: false, isDestructive: true } },
  ]);
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) await Notifications.requestPermissionsAsync();
}

export async function exactAlarmsAllowed() {
  if (Platform.OS !== "android") return true;
  return (await Notifications.getExactAlarmPermissionsAsync()).granted;
}

export async function requestExactAlarms() {
  if (Platform.OS === "android") await Notifications.requestExactAlarmPermissionsAsync();
}

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const dayText = (dayKey: string) => `${Number(dayKey.slice(8))} ${MONTHS[Number(dayKey.slice(5, 7)) - 1]}`;

/** Gün kartının bildirime sığan hali */
function dayCardContent(g: Schedule["groups"][number], deadline: Date, dayKey: string) {
  const books = g.books && g.books.length > 1 ? ` · ${g.books.length} eser` : g.books?.[0] && g.books[0] !== "Günlük okuma" ? ` · ${g.books[0]}` : "";
  return {
    title: `📖 ${g.name} · ${dayText(dayKey)}`,
    body: `Hedef ${g.dailyPages} sf${g.minPages != null ? ` (alt sınır ${g.minPages})` : ""}${books}\nSon bildirim ${hhmm(deadline)} · butonlarla hemen bildir`,
  };
}

const STICKY_KEY = "sticky-today";
/** Kilit ekranında sabit bildirim tercihi (isteğe bağlı, varsayılan kapalı) */
export async function getStickyPref() {
  return (await SecureStore.getItemAsync(STICKY_KEY).catch(() => null)) === "1";
}
export async function setStickyPref(on: boolean) {
  await SecureStore.setItemAsync(STICKY_KEY, on ? "1" : "0").catch(() => {});
}

/**
 * Okuma günü açık ve henüz bildirilmemiş her grup için kilit ekranında duran (kaydırılarak silinemeyen)
 * gün kartı bildirimi gösterir; bildirildiyse ya da gün kapandıysa kaldırır.
 */
export async function showTodaySticky(data: Schedule) {
  const on = await getStickyPref();
  const now = Date.now();
  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  for (const g of data.groups) {
    const id = `today-${g.groupId}`;
    const p = g.periods.find((x) => new Date(x.start).getTime() <= now && new Date(x.deadline).getTime() > now);
    const show = on && p && !p.reported;
    const mine = presented.filter((n) => (n.request.content.data as Partial<ReportData> | undefined)?.groupId === g.groupId);
    if (!show) {
      // Bildirildi ya da gün kapandı: o grubun sabit kartını kaldır
      for (const n of mine) if ((n.request.content.data as Partial<ReportData>)?.sticky || n.request.identifier === id) await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
      continue;
    }
    // Bugün için (gün başı bildirimi dahil) zaten bir kart görünüyorsa tekrar çaldırma
    if (mine.some((n) => (n.request.content.data as Partial<ReportData>)?.dayKey === p.dayKey && (n.request.content.data as Partial<ReportData>)?.sticky)) continue;
    const payload: ReportData = { token: p.token, groupId: g.groupId, dayKey: p.dayKey, sticky: true };
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { ...dayCardContent(g, new Date(p.deadline), p.dayKey), categoryIdentifier: REPORT_CATEGORY, data: payload, sticky: true, autoDismiss: false },
      trigger: Platform.OS === "android" ? { channelId: "today" } : null,
    });
  }
}

/** Profildeki "Deneme bildirimi": açık okuma günü varsa gün kartı bildirimi, yoksa basit bir deneme */
export async function sendTestNotification(fetchSchedule: () => Promise<Schedule>) {
  const data = await fetchSchedule().catch(() => null);
  const now = Date.now();
  for (const g of data?.groups ?? []) {
    const p = g.periods.find((x) => new Date(x.start).getTime() <= now && new Date(x.deadline).getTime() > now);
    if (!p) continue;
    const payload: ReportData = { token: p.token, groupId: g.groupId, dayKey: p.dayKey };
    await Notifications.scheduleNotificationAsync({
      content: { ...dayCardContent(g, new Date(p.deadline), p.dayKey), categoryIdentifier: REPORT_CATEGORY, data: payload },
      trigger: Platform.OS === "android" ? { channelId: "today" } : null,
    });
    return true;
  }
  await Notifications.scheduleNotificationAsync({
    content: { title: "🔔 Okuma Takip", body: "Bildirimler çalışıyor. Okuma günü başlayınca gün kartı burada butonlarıyla görünecek." },
    trigger: Platform.OS === "android" ? { channelId: "reminders" } : null,
  });
  return false;
}

/** Sunucudaki okuma günlerine göre bildirimleri yeniden planlar. */
export async function syncSchedule(fetchSchedule: () => Promise<Schedule>) {
  let data: Schedule;
  try {
    data = await fetchSchedule();
  } catch (e) {
    lastSync = { at: Date.now(), error: `Plan alınamadı: ${(e as Error).message}`, count: 0 };
    throw e;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const sticky = await getStickyPref();
  await showTodaySticky(data).catch(() => {});
  const jobs: Promise<string>[] = [];
  for (const g of data.groups) {
    for (const p of g.periods) {
      const start = new Date(p.start).getTime();
      const deadline = new Date(p.deadline);
      // Gün başladıktan sonra katılan (ya da grubu kuran) kişiye ceza yazılmaz ama bildirebilir: bildirimler yine planlanır
      if (p.reported) continue;
      const data: ReportData = { token: p.token, groupId: g.groupId, dayKey: p.dayKey };
      const at = (t: number, channelId: string) =>
        ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: t, channelId, delivery: "alarmClock" }) as const;

      // Gün başlarken gün kartı bildirimi
      if (start > now) {
        jobs.push(
          Notifications.scheduleNotificationAsync({
            identifier: `day-${g.groupId}-${p.dayKey}`,
            content: { ...dayCardContent(g, deadline, p.dayKey), categoryIdentifier: REPORT_CATEGORY, data: { ...data, sticky }, sticky, autoDismiss: false },
            trigger: at(start, "today"),
          }),
        );
      }

      const remindAt = deadline.getTime() - g.reminderHours * 3_600_000;
      if (g.reminderHours > 0 && remindAt > now && remindAt >= start) {
        jobs.push(
          Notifications.scheduleNotificationAsync({
            content: {
              title: `📚 ${g.name}: okuma hatırlatması`,
              body: `Bugünkü ${g.dailyPages} sayfanı henüz bildirmedin. Son bildirim saati ${hhmm(deadline)}.`,
              categoryIdentifier: REPORT_CATEGORY,
              data,
            },
            trigger: at(remindAt, "reminders"),
          }),
        );
      }
      for (const m of COUNTDOWN_MINUTES) {
        const t = deadline.getTime() - m * 60_000;
        if (t <= now) continue;
        jobs.push(
          Notifications.scheduleNotificationAsync({
            identifier: `cd-${g.groupId}-${p.dayKey}-${m}`,
            content: {
              title: `⏳ ${m} dakika kaldı · ${g.name}`,
              body: `Son bildirim ${hhmm(deadline)}. Okuduysan hemen bildir, yoksa ceza yazılacak!`,
              categoryIdentifier: REPORT_CATEGORY,
              data,
            },
            trigger: at(t, "countdown"),
          }),
        );
      }
    }
  }
  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  lastSync = { at: Date.now(), count: results.length - failed.length, error: failed.length ? `${failed.length} bildirim planlanamadı: ${String(failed[0].reason?.message ?? failed[0].reason)}` : null };
}

/** Son plan senkronizasyonunun sonucu (profildeki bildirim durumu için) */
let lastSync: { at: number; count: number; error: string | null } | null = null;
export function getLastSync() {
  return lastSync;
}

/** Cihazda planlı bildirimlerin sayısı ve en yakını */
export async function scheduledSummary() {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const times = all
    .map((n) => {
      const t = n.trigger as { value?: number; date?: number; timestamp?: number } | null;
      return t?.value ?? t?.timestamp ?? t?.date ?? null;
    })
    .filter((x): x is number => typeof x === "number")
    .sort((a, b) => a - b);
  return { count: all.length, next: times[0] ? new Date(times[0]) : null };
}

/** Bildirimdeki hızlı butona basıldığında okumayı sunucuya iletir (uygulama kapalıyken de çalışır). */
export async function handleReportAction(actionId: string, data: ReportData, userText?: string) {
  if (!["all", "pages", "min", "none"].includes(actionId) || !data?.token) return false;
  const res = await fetch(`${API_URL}/api/quick-report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: data.token, choice: actionId, pages: userText ? Number(userText) : undefined }),
  });
  const body = (await res.json().catch(() => ({}))) as { pages?: number; required?: number; error?: string };
  if (res.ok) {
    // Bu gün için kalan hatırlatmaları iptal et
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => {
          const d = n.content.data as Partial<ReportData> | undefined;
          return d?.groupId === data.groupId && d?.dayKey === data.dayKey;
        })
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  }
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    identifier: "report-result",
    content: {
      title: res.ok ? "Bildirim kaydedildi ✓" : "Bildirilemedi",
      body: res.ok
        ? `${body.pages} sayfa bildirildi${body.required && body.pages! < body.required ? ` (hedef ${body.required})` : ""}.`
        : body.error ?? "Uygulamayı açıp tekrar deneyin.",
    },
    trigger: null,
  });
  return true;
}
