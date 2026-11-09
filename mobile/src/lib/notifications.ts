// Okuma günü hatırlatmaları ve son 10 dakika geri sayımı cihazda planlanır;
// böylece internet ya da push servisi olmadan da tam zamanında gelir.
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "./config";
import { enqueue } from "./offline";
import { LITE } from "./variant";
import type { DayCard } from "./types";
import { dayCardNotificationAvailable, hideDayCardNotification, scheduleDayCardNotificationsJson, showDayCardNotification, type DayCardPayload } from "../../modules/day-card-notification";

export const REPORT_CATEGORY = "REPORT";
// Tam sürüm: son 10 dakikada her dakika. Lite: telefonu yormasın, yalnızca 10 ve 1 dakika kala
const COUNTDOWN_MINUTES = LITE ? [10, 1] : [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
/** Kaç okuma günü ileriye planlanır (uygulama uzun süre açılmasa da bildirimler gelsin) */
export const PLAN_DAYS = LITE ? 4 : 7;
export const SCHEDULE_PATH = `/api/me/schedule?days=${PLAN_DAYS}`;

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
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Grup mesajları",
      description: "Gruplara yazılan yeni mesajlar ve anketler",
      // eslint-disable-next-line import/namespace -- enum `export *` ile geliyor, eklenti göremiyor
      importance: Notifications.AndroidImportance.DEFAULT,
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
  if (LITE) return false; // Lite: kilit ekranı sabit kartı yok
  return (await SecureStore.getItemAsync(STICKY_KEY).catch(() => null)) === "1";
}
export async function setStickyPref(on: boolean) {
  await SecureStore.setItemAsync(STICKY_KEY, on ? "1" : "0").catch(() => {});
}

// Kilit ekranı kartının içeriği için uygulamadaki gün kartları (me verisinden)
let dayCards: Record<string, { name: string; card: DayCard }> = {};
let lastSchedule: Schedule | null = null;
let lastNativePlan = "";

/** Gün kartları değişince (okuma bildirildi, kefaret vb.) kilit ekranı kartı da güncellensin */
export function setDayCards(groups: { group: { id: string; name: string }; card: DayCard }[]) {
  dayCards = Object.fromEntries(groups.map((g) => [g.group.id, { name: g.group.name, card: g.card }]));
  if (lastSchedule) showTodaySticky(lastSchedule).catch(() => {});
}

/**
 * Uygulamadaki gün kartının özü: başlık, kalan süre, ilerleme, kefaret ve eser butonları + çentikler.
 * Gelecek günler için (gün başı alarmı) eserler bugünkü karttan, okuma bilgisi boş olarak alınır.
 */
function dayCardPayload(g: Schedule["groups"][number], p: Schedule["groups"][number]["periods"][number]): DayCardPayload {
  const entry = dayCards[g.groupId];
  const today = entry?.card.dayKey === p.dayKey;
  const card = today ? entry.card : null;
  const base = entry?.card.me ?? null;
  const me = card?.me ?? null;
  const target = base?.target ?? g.dailyPages;
  const min = base?.min ?? g.minPages ?? 0;
  // Gelecek günde kefaret yalnızca plan bitmeyecekse sürer
  const plan = today ? (me?.plan ?? null) : base?.plan && base.plan.doneDays + (base.kefaret ? 1 : 0) < base.plan.days ? base.plan : null;
  const total = card ? card.read.length + card.min.length + card.none.length + card.pending.length : 0;
  // Eser kimliği bilinmiyorsa (uygulama verisi yok) boş kimlik: butonlar tüm eserler için gönderilir
  const list = base?.books?.length
    ? base.books.map((b) => ({ ...b, pages: today ? b.pages : null }))
    : [{ id: "", title: g.books?.length === 1 ? g.books[0] : "Günlük okuma", target, min, pages: null }];
  // Kefaret okumasında her esere düşen sayfa (sunucudaki dağıtımla aynı: hedefleri oranında)
  const sum = list.reduce((n, b) => n + b.target, 0) || 1;
  let left = plan?.dailyExtra ?? 0;
  const books = list.map((b, i) => {
    const share = !plan ? 0 : i === list.length - 1 ? left : Math.min(left, Math.floor((plan.dailyExtra * b.target) / sum));
    left -= share;
    return { id: b.id, title: b.title, target: b.target, min: b.min, pages: b.pages, ...(plan ? { kefPages: b.target + share } : {}) };
  });
  return {
    id: g.groupId,
    dayKey: p.dayKey,
    token: p.token,
    apiUrl: API_URL,
    title: entry?.name ?? g.name,
    subtitle: `${dayText(p.dayKey)} · son bildirim ${hhmm(new Date(p.deadline))}`,
    deadline: new Date(p.deadline).getTime(),
    done: card ? card.read.length + card.min.length : 0,
    total,
    kefCount: card ? card.read.filter((x) => x.kefaret).length : 0,
    books,
    plan: !!plan,
    kefaretOn: !!me?.kefaret,
    fineMin: base?.fine?.min ?? 0,
    fineNone: base?.fine?.none ?? 0,
    kefaretLine: plan ? `Kefaret ${plan.doneDays}${today && me?.kefaret ? "+1" : !today && base?.kefaret ? "+1" : ""}/${plan.days} gün · ${plan.earned}/${plan.discountTotal} TL silindi` : null,
  };
}

/**
 * Kilit ekranında duran gün kartı. Android'de (tam sürüm) uygulamadaki gün kartının tasarımıyla özel bildirim;
 * okuma bildirilse de gün boyunca durur ve seçili butonu gösterir; gün kapanınca kalkar.
 * Özel bildirim yoksa (eski sürüm) basit sabit bildirim kullanılır.
 */
export async function showTodaySticky(data: Schedule) {
  lastSchedule = data;
  const on = await getStickyPref();
  const now = Date.now();
  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  if (dayCardNotificationAvailable) {
    for (const g of data.groups) {
      const p = g.periods.find((x) => new Date(x.start).getTime() <= now && new Date(x.deadline).getTime() > now);
      // Aynı günün basit sabit bildirimi (gün başı) varsa kaldır: tek kart kalsın
      for (const n of presented) {
        const d = n.request.content.data as Partial<ReportData> | undefined;
        if (d?.groupId === g.groupId && (d.sticky || n.request.identifier === `today-${g.groupId}`)) await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
      }
      if (on && p) showDayCardNotification(dayCardPayload(g, p));
      else hideDayCardNotification(g.groupId);
    }
    // Sonraki günlerin kartları gün başında sistem alarmıyla, uygulama açılmadan gösterilir
    const next = on
      ? data.groups.flatMap((g) => g.periods.filter((x) => new Date(x.start).getTime() > now).map((x) => ({ ...dayCardPayload(g, x), start: new Date(x.start).getTime() })))
      : [];
    // Plan değişmediyse alarmlara dokunulmaz (eski cihazlarda gereksiz sistem çağrısı olmasın)
    const json = JSON.stringify(next);
    if (json !== lastNativePlan) {
      lastNativePlan = json;
      scheduleDayCardNotificationsJson(json);
    }
    return;
  }
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

type Planned = { identifier: string; key: string; request: Notifications.NotificationRequestInput };
const PLAN_KEY = "notif-plan-v2";
/** Geri sayım yalnızca en yakın iki okuma günü için planlanır (cihazda gereksiz alarm birikmesin) */
const COUNTDOWN_PERIODS = LITE ? 1 : 2;

/** Planlanması gereken bildirimler (her biri sabit kimlikli; aynı plan tekrar kurulmaz) */
function buildPlan(data: Schedule, sticky: boolean, now: number): Planned[] {
  const out: Planned[] = [];
  // Kilit ekranı kartı (yerel) açıksa: gün başı kartını sistem alarmı gösterir; hatırlatmalardaki butonlar
  // uygulama kapalıyken JS başlamadan çalışmadığından kaldırılır, okuma karttaki butonlarla bildirilir
  const native = dayCardNotificationAvailable && sticky;
  const category = native ? {} : { categoryIdentifier: REPORT_CATEGORY };
  // Not: "alarmClock" teslimi kullanılmaz. Android 10 ve öncesinde her bildirim çalar saat alarmı olarak
  // kurulup durum çubuğu/kilit ekranındaki "sonraki alarm"ı sürekli değiştiriyor, eski Samsung'larda
  // (One UI 2) sistem arayüzünü kilitliyordu. Varsayılan tam zamanlı alarm yeterli.
  const at = (t: number, channelId: string) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: t, channelId }) as const;
  const add = (identifier: string, t: number, content: Notifications.NotificationContentInput, channelId: string) =>
    out.push({ identifier, key: `${t}|${channelId}|${content.title}|${content.body}|${content.sticky ? 1 : 0}|${content.categoryIdentifier ?? ""}`, request: { identifier, content, trigger: at(t, channelId) } });
  for (const g of data.groups) {
    let countdownPeriods = 0;
    for (const p of g.periods) {
      const start = new Date(p.start).getTime();
      const deadline = new Date(p.deadline);
      if (p.reported) continue;
      const payload: ReportData = { token: p.token, groupId: g.groupId, dayKey: p.dayKey };
      // Gün başlarken gün kartı bildirimi
      if (start > now && !native) add(`day-${g.groupId}-${p.dayKey}`, start, { ...dayCardContent(g, deadline, p.dayKey), categoryIdentifier: REPORT_CATEGORY, data: { ...payload, sticky }, sticky, autoDismiss: false }, "today");
      const remindAt = deadline.getTime() - g.reminderHours * 3_600_000;
      if (g.reminderHours > 0 && remindAt > now && remindAt >= start) {
        add(
          `rem-${g.groupId}-${p.dayKey}`,
          remindAt,
          { title: `📚 ${g.name}: okuma hatırlatması`, body: `Bugünkü ${g.dailyPages} sayfanı henüz bildirmedin. Son bildirim saati ${hhmm(deadline)}.`, ...category, data: payload },
          "reminders",
        );
      }
      if (countdownPeriods++ >= COUNTDOWN_PERIODS) continue;
      for (const m of COUNTDOWN_MINUTES) {
        const t = deadline.getTime() - m * 60_000;
        if (t <= now) continue;
        add(
          `cd-${g.groupId}-${p.dayKey}-${m}`,
          t,
          { title: `⏳ ${m} dakika kaldı · ${g.name}`, body: `Son bildirim ${hhmm(deadline)}. Okuduysan hemen bildir, yoksa ceza yazılacak!`, ...category, data: payload },
          "countdown",
        );
      }
    }
  }
  return out;
}

let syncing: Promise<void> | null = null;
let again = false;

/**
 * Sunucudaki okuma günlerine göre bildirimleri planlar. Yalnızca değişen bildirimler iptal edilip
 * yeniden kurulur; plan aynıysa cihaza hiç dokunulmaz (eski cihazlarda sistem arayüzünü yormamak için).
 */
export async function syncSchedule(fetchSchedule: () => Promise<Schedule>): Promise<void> {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        again = false;
        await syncOnce(fetchSchedule);
      } while (again);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function syncOnce(fetchSchedule: () => Promise<Schedule>) {
  let data: Schedule;
  try {
    data = await fetchSchedule();
  } catch (e) {
    lastSync = { at: Date.now(), error: `Plan alınamadı: ${(e as Error).message}`, count: 0 };
    throw e;
  }
  const now = Date.now();
  const sticky = await getStickyPref();
  await showTodaySticky(data).catch(() => {});
  const plan = buildPlan(data, sticky, now);

  const raw = await AsyncStorage.getItem(PLAN_KEY).catch(() => null);
  let prev: Record<string, string> | null = null;
  try {
    prev = raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {}
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const existing = new Set(scheduled.map((n) => n.identifier));
  const wanted = new Map(plan.map((p) => [p.identifier, p]));

  let cancel: string[];
  let create: Planned[];
  if (!prev) {
    // İlk çalıştırma (ya da eski sürümden geçiş): eski alarmların hepsi kaldırılıp plan baştan kurulur
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    cancel = [];
    create = plan;
  } else {
    cancel = scheduled.map((n) => n.identifier).filter((id) => !wanted.has(id) || prev![id] !== wanted.get(id)!.key);
    create = plan.filter((p) => !existing.has(p.identifier) || prev![p.identifier] !== p.key);
  }
  // Sırayla: aynı anda onlarca alarm isteği göndermek eski cihazları yoruyor
  for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  let failed = 0;
  let firstError = "";
  const done: Record<string, string> = {};
  for (const p of plan) if (!create.includes(p) && existing.has(p.identifier)) done[p.identifier] = p.key;
  for (const p of create) {
    try {
      await Notifications.scheduleNotificationAsync(p.request);
      done[p.identifier] = p.key;
    } catch (e) {
      failed++;
      firstError ||= String((e as Error)?.message ?? e);
    }
  }
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(done)).catch(() => {});
  lastSync = { at: Date.now(), count: Object.keys(done).length, error: failed ? `${failed} bildirim planlanamadı: ${firstError}` : null };
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

const HANDLED_KEY = "handled-actions";
/**
 * Aynı buton basışı hem arka plan görevine hem uygulama açılınca dinleyiciye gelebilir;
 * ikinci kez gönderilmesin.
 */
async function alreadyHandled(key: string) {
  const list = JSON.parse((await AsyncStorage.getItem(HANDLED_KEY).catch(() => null)) ?? "[]") as string[];
  if (list.includes(key)) return true;
  await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([key, ...list].slice(0, 30))).catch(() => {});
  return false;
}

/** Yalnızca bu grubun bu günkü bildirimlerini kaldırır (diğer grupların kartları kalsın) */
async function dismissDayNotifications(data: Pick<ReportData, "groupId" | "dayKey">) {
  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  for (const n of presented) {
    const d = n.request.content.data as Partial<ReportData> | undefined;
    if (n.request.identifier === "report-result" || (d?.groupId === data.groupId && d?.dayKey === data.dayKey)) {
      await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
    }
  }
}

/** Bildirimdeki hızlı butona basıldığında okumayı sunucuya iletir (uygulama kapalıyken de çalışır). */
export async function handleReportAction(actionId: string, data: ReportData, userText?: string, key?: string) {
  if (!["all", "pages", "min", "none"].includes(actionId) || !data?.token) return false;
  if (key && (await alreadyHandled(key))) return true;
  const payload = { token: data.token, choice: actionId, pages: userText ? Number(userText) : undefined };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/quick-report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  } catch {
    // İnternet yok: bildirim butonundaki seçim sıraya alınır, bağlanınca işlem anıyla gönderilir
    const label = { all: "Okudum", min: "Alt sınırı okudum", none: "Okumadım", pages: "Sayfa bildirimi" }[actionId] ?? "Bildirim";
    await enqueue({ kind: "quick", groupId: data.groupId, dayKey: data.dayKey, label, body: payload });
    await dismissDayNotifications(data);
    await Notifications.scheduleNotificationAsync({
      identifier: "report-result",
      content: { title: "📴 Çevrimdışı kaydedildi", body: `${label}: internet gelince işlem saatiyle gönderilecek.` },
      trigger: null,
    });
    return true;
  }
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
  await dismissDayNotifications(data);
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
