const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const TZ = 180; // Türkiye saati (UTC+3)

export function minuteToTime(m: number) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function timeToMinute(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatDayKey(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateTime(iso: string | Date, tzOffset = TZ) {
  const d = new Date(new Date(iso).getTime() + tzOffset * 60_000);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Grup saat dilimindeki tarih-saati sunucunun beklediği "YYYY-MM-DDTHH:mm" biçimine çevirir */
export function toLocalInput(date: Date, tzOffset = TZ) {
  return new Date(date.getTime() + tzOffset * 60_000).toISOString().slice(0, 16);
}

export function formatIban(iban: string) {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} gün ${h} sa`;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

const DAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function formatDayLong(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${DAYS_TR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

export function formatClock(iso: string | Date, tzOffset = TZ) {
  const d = new Date(new Date(iso).getTime() + tzOffset * 60_000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
