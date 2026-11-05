// Okuma günü hesapları. Tüm saatler grubun yerel saatine göre (varsayılan UTC+3).
export const MIN = 60_000;
export const DAY = 86_400_000;

export type GroupSchedule = {
  startMinute: number;
  deadlineMinute: number;
  tzOffset: number;
  reminderHours: number;
};

export type Period = {
  dayKey: string;
  start: Date;
  deadline: Date;
  nextStart: Date;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dayKeyFromUtcMidnight(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function utcMidnightFromKey(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function shiftDayKey(dayKey: string, days: number) {
  return dayKeyFromUtcMidnight(utcMidnightFromKey(dayKey) + days * DAY);
}

/** Okuma günü süresi (dakika). Başlangıç = bitiş ise tam 24 saat. */
export function periodLengthMinutes(g: Pick<GroupSchedule, "startMinute" | "deadlineMinute">) {
  const diff = (g.deadlineMinute - g.startMinute + 1440) % 1440;
  return diff === 0 ? 1440 : diff;
}

export function periodFor(dayKey: string, g: GroupSchedule): Period {
  const startMs = utcMidnightFromKey(dayKey) + g.startMinute * MIN - g.tzOffset * MIN;
  const deadlineMs = startMs + periodLengthMinutes(g) * MIN;
  return {
    dayKey,
    start: new Date(startMs),
    deadline: new Date(deadlineMs),
    nextStart: new Date(startMs + DAY),
  };
}

/** Şu anı içeren (başlamış) okuma günü. Son saat geçmiş olabilir. */
export function currentPeriod(now: Date, g: GroupSchedule): Period {
  const localMs = now.getTime() + g.tzOffset * MIN;
  const localMidnight = Math.floor(localMs / DAY) * DAY;
  const minuteOfDay = Math.floor((localMs - localMidnight) / MIN);
  const key = dayKeyFromUtcMidnight(minuteOfDay >= g.startMinute ? localMidnight : localMidnight - DAY);
  return periodFor(key, g);
}

/** Bildirim yapılabilen okuma günü (şu an açık olan) ya da null. */
export function openPeriod(now: Date, g: GroupSchedule): Period | null {
  const p = currentPeriod(now, g);
  return now < p.deadline ? p : null;
}

/** Son saati geçmiş en yeni okuma günü. */
export function lastClosedPeriod(now: Date, g: GroupSchedule): Period {
  const p = currentPeriod(now, g);
  return now >= p.deadline ? p : periodFor(shiftDayKey(p.dayKey, -1), g);
}

export function minuteToTime(m: number) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function timeToMinute(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function formatDayKey(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return `${d} ${months[m - 1]} ${y}`;
}

export function formatDateTime(date: Date, tzOffset = 180) {
  const d = new Date(date.getTime() + tzOffset * MIN);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}


const DAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "4 Kasım Çarşamba" */
export function formatDayLong(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return `${d} ${MONTHS_TR[m - 1]} ${DAYS_TR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

/** Saat (Türkiye) — "23:59" */
export function formatClock(iso: string | Date, tzOffset = 180) {
  const d = new Date(new Date(iso).getTime() + tzOffset * MIN);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
