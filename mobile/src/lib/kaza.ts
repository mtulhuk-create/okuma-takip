// Namaz kaza takibi: vakitler, renkler, toplu hesaplama ve bildirim kartı tercihi
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CloudSun, Moon, MoonStar, Sun, Sunrise, Sunset, type LucideIcon } from "lucide-react-native";
import { API_URL } from "./config";
import { LITE } from "./variant";
import { hideKazaNotification, kazaNotificationAvailable, showKazaNotification } from "../../modules/day-card-notification";

export const PRAYERS = ["sabah", "ogle", "ikindi", "aksam", "yatsi", "vitir"] as const;
export type Prayer = (typeof PRAYERS)[number];
export type Counts = Record<Prayer, number>;

/** Sayfanın ana rengi (gece mavisi) */
export const KAZA = "#4f46e5";

export const PRAYER_INFO: Record<Prayer, { label: string; Icon: LucideIcon; color: string }> = {
  sabah: { label: "Sabah", Icon: Sunrise, color: "#0ea5e9" },
  ogle: { label: "Öğle", Icon: Sun, color: "#eab308" },
  ikindi: { label: "İkindi", Icon: CloudSun, color: "#f97316" },
  aksam: { label: "Akşam", Icon: Sunset, color: "#e11d48" },
  yatsi: { label: "Yatsı", Icon: Moon, color: "#6366f1" },
  vitir: { label: "Vitir", Icon: MoonStar, color: "#8b5cf6" },
};

export type KazaState = {
  enabled: boolean;
  remaining: Counts;
  made: Counts;
  dailyGoal: number;
  today: number;
  streak: number;
  week: { dayKey: string; count: number }[];
  token?: string;
};

export const sum = (c: Counts) => PRAYERS.reduce((n, p) => n + (c[p] ?? 0), 0);

export type CalcInput = {
  female: boolean;
  birth: Date;
  bulugh: number; // buluğ yaşı
  start: Date; // namaza düzenli başlama tarihi
  prayedPercent: number; // bu sürede kılınan namaz oranı
  hayiz: number; // kadınlarda aylık ortalama hayız günü
  nifas: number; // toplam nifas (lohusalık) günü
  vitir: boolean; // Hanefi: vitir vacip, kazası gerekir
};

/**
 * Toplu kaza hesabı (Hanefi esaslı yaygın yöntem):
 * 1. Buluğ tarihi = doğum + buluğ yaşı (bilinmiyorsa 15 alınır)
 * 2. Gün = buluğ tarihinden namaza düzenli başlanan tarihe kadar geçen gün
 * 3. Kadınlarda hayız (ay başına ortalama gün) ve nifas günleri düşülür; bu günlerin namazı kaza edilmez
 * 4. Bu sürede kılınan namaz oranı düşülür
 * 5. Kalan gün sayısı kadar her vakit (5 vakit farz + vitir) kaza edilir
 */
export function calcKaza(i: CalcInput) {
  const bulughAt = new Date(i.birth);
  bulughAt.setFullYear(bulughAt.getFullYear() + i.bulugh);
  const days = Math.max(0, Math.floor((i.start.getTime() - bulughAt.getTime()) / 86_400_000));
  const exempt = i.female ? Math.min(days, Math.round((days / 30.44) * i.hayiz) + i.nifas) : 0;
  const due = days - exempt;
  const perPrayer = Math.round(due * (1 - Math.min(100, Math.max(0, i.prayedPercent)) / 100));
  const counts = Object.fromEntries(PRAYERS.map((p) => [p, p === "vitir" && !i.vitir ? 0 : perPrayer])) as Counts;
  return { bulughAt, days, exempt, due, perPrayer, counts, total: sum(counts) };
}

/** "GG.AA.YYYY" ya da "YYYY" → tarih */
export function parseDate(s: string): Date | null {
  const t = s.trim();
  const y = /^(\d{4})$/.exec(t);
  if (y) return new Date(Number(y[1]), 6, 1);
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
}

// Bildirim panelinde kaza kartı (tam sürüm)
const STICKY_KEY = "kaza-sticky";
export async function getKazaStickyPref() {
  if (LITE || !kazaNotificationAvailable) return false;
  return (await AsyncStorage.getItem(STICKY_KEY).catch(() => null)) === "1";
}
export async function setKazaStickyPref(on: boolean) {
  await AsyncStorage.setItem(STICKY_KEY, on ? "1" : "0").catch(() => {});
}

/** Kaza kartını güncel sayılarla gösterir ya da kaldırır */
export async function syncKazaCard(s: KazaState | undefined) {
  if (!s || !kazaNotificationAvailable) return;
  const on = await getKazaStickyPref();
  if (!on || !s.enabled || !s.token) {
    hideKazaNotification();
    return;
  }
  showKazaNotification({
    token: s.token,
    apiUrl: API_URL,
    remaining: s.remaining,
    today: s.today,
    goal: s.dailyGoal,
    labels: Object.fromEntries(PRAYERS.map((p) => [p, PRAYER_INFO[p].label])) as Record<Prayer, string>,
  });
}
