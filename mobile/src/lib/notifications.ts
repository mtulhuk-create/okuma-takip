// Okuma günü hatırlatmaları ve son 10 dakika geri sayımı cihazda planlanır;
// böylece internet ya da push servisi olmadan da tam zamanında gelir.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { API_URL } from "./config";

export const REPORT_CATEGORY = "REPORT";
const COUNTDOWN_MINUTES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

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

export type ReportData = { token: string; groupId: string; dayKey: string };

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
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
    await Notifications.setNotificationChannelAsync("countdown", {
      name: "Son 10 dakika geri sayımı",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200],
    });
  }
  await Notifications.setNotificationCategoryAsync(REPORT_CATEGORY, [
    {
      identifier: "pages",
      buttonTitle: "📖 Okudum",
      textInput: { submitButtonTitle: "Gönder", placeholder: "Kaç sayfa okudun?" },
      options: { opensAppToForeground: false },
    },
    { identifier: "min", buttonTitle: "✅ Alt sınırı okudum", options: { opensAppToForeground: false } },
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

/** Sunucudaki okuma günlerine göre bildirimleri yeniden planlar. */
export async function syncSchedule(fetchSchedule: () => Promise<Schedule>) {
  const data = await fetchSchedule();
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const jobs: Promise<string>[] = [];
  for (const g of data.groups) {
    for (const p of g.periods) {
      const start = new Date(p.start).getTime();
      const deadline = new Date(p.deadline);
      if (p.reported || new Date(g.eligibleFrom).getTime() > start) continue;
      const data: ReportData = { token: p.token, groupId: g.groupId, dayKey: p.dayKey };
      const at = (t: number, channelId: string) =>
        ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: t, channelId, delivery: "alarmClock" }) as const;

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
  await Promise.all(jobs);
}

/** Bildirimdeki hızlı butona basıldığında okumayı sunucuya iletir (uygulama kapalıyken de çalışır). */
export async function handleReportAction(actionId: string, data: ReportData, userText?: string) {
  if (!["pages", "min", "none"].includes(actionId) || !data?.token) return false;
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
