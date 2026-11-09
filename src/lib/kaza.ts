import "server-only";
import { getDb } from "./db";

// Namaz kaza takibi: kalan ve kılınan kazalar vakit vakit tutulur (beş vakit farz + vitir)
export const PRAYERS = ["sabah", "ogle", "ikindi", "aksam", "yatsi", "vitir"] as const;
export type Prayer = (typeof PRAYERS)[number];
export type Counts = Record<Prayer, number>;

const MAX = 1_000_000;
const isPrayer = (p: unknown): p is Prayer => typeof p === "string" && (PRAYERS as readonly string[]).includes(p);

function counts(j: unknown): Counts {
  const o = (j && typeof j === "object" ? j : {}) as Record<string, unknown>;
  return Object.fromEntries(PRAYERS.map((p) => [p, Math.max(0, Math.min(MAX, Math.floor(Number(o[p]) || 0)))])) as Counts;
}

/** Türkiye saatine göre gün (kaza takibi kişisel; grup saat dilimi yok) */
export function kazaDayKey(now = Date.now()) {
  return new Date(now + 3 * 3_600_000).toISOString().slice(0, 10);
}
const shift = (k: string, n: number) => new Date(Date.parse(k) + n * 86_400_000).toISOString().slice(0, 10);

export async function kazaState(userId: string) {
  const db = getDb();
  const today = kazaDayKey();
  const [k, days] = await Promise.all([
    db.kaza.findUnique({ where: { userId } }),
    db.kazaDay.findMany({ where: { userId, dayKey: { gte: shift(today, -89) } }, orderBy: { dayKey: "desc" } }),
  ]);
  const byDay = new Map(days.map((d) => [d.dayKey, d.count]));
  // Seri: bugünden (bugün henüz kılınmadıysa dünden) geriye kesintisiz kaza kılınan gün
  let streak = 0;
  for (let i = byDay.get(today) ? 0 : 1; i < 90 && (byDay.get(shift(today, -i)) ?? 0) > 0; i++) streak++;
  return {
    enabled: k?.enabled ?? false,
    remaining: counts(k?.remaining),
    made: counts(k?.made),
    dailyGoal: k?.dailyGoal ?? 0,
    today: byDay.get(today) ?? 0,
    streak,
    // Son 14 gün (eskiden yeniye)
    week: Array.from({ length: 14 }, (_, i) => {
      const d = shift(today, i - 13);
      return { dayKey: d, count: byDay.get(d) ?? 0 };
    }),
  };
}

export type KazaOp =
  | { op: "enable"; on: boolean }
  | { op: "make"; prayer: Prayer }
  | { op: "undo"; prayer: Prayer }
  | { op: "set"; counts: Partial<Counts>; mode: "replace" | "add" }
  | { op: "goal"; goal: number };

/** İstek gövdesini doğrular; geçersizse null */
export function parseKazaOp(b: unknown): KazaOp | null {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  switch (o.op) {
    case "enable":
      return { op: "enable", on: o.on === true };
    case "make":
    case "undo":
      return isPrayer(o.prayer) ? { op: o.op, prayer: o.prayer } : null;
    case "set":
      return { op: "set", counts: counts(o.counts), mode: o.mode === "add" ? "add" : "replace" };
    case "goal":
      return { op: "goal", goal: Math.max(0, Math.min(100, Math.floor(Number(o.goal) || 0))) };
    default:
      return null;
  }
}

/** Kaza işlemi: kılındı (kalan −1), geri al, toplu ayarla/ekle, günlük hedef, aç/kapat */
export async function applyKaza(userId: string, op: KazaOp) {
  const db = getDb();
  const today = kazaDayKey();
  await db.$transaction(async (tx) => {
    const k = await tx.kaza.upsert({ where: { userId }, create: { userId }, update: {} });
    const remaining = counts(k.remaining);
    const made = counts(k.made);
    if (op.op === "enable") {
      await tx.kaza.update({ where: { userId }, data: { enabled: op.on } });
      return;
    }
    if (op.op === "goal") {
      await tx.kaza.update({ where: { userId }, data: { dailyGoal: op.goal } });
      return;
    }
    if (op.op === "set") {
      for (const p of PRAYERS) remaining[p] = Math.min(MAX, (op.mode === "add" ? remaining[p] : 0) + (op.counts[p] ?? 0));
      await tx.kaza.update({ where: { userId }, data: { remaining, enabled: true } });
      return;
    }
    if (op.op === "make") {
      if (remaining[op.prayer] <= 0) throw new Error("Bu vaktin kazası kalmadı");
      remaining[op.prayer]--;
      made[op.prayer]++;
      await tx.kazaDay.upsert({ where: { userId_dayKey: { userId, dayKey: today } }, create: { userId, dayKey: today, count: 1 }, update: { count: { increment: 1 } } });
    } else {
      if (made[op.prayer] <= 0) throw new Error("Geri alınacak kaza yok");
      made[op.prayer]--;
      remaining[op.prayer]++;
      const d = await tx.kazaDay.findUnique({ where: { userId_dayKey: { userId, dayKey: today } } });
      if (d && d.count > 0) await tx.kazaDay.update({ where: { userId_dayKey: { userId, dayKey: today } }, data: { count: { decrement: 1 } } });
    }
    await tx.kaza.update({ where: { userId }, data: { remaining, made } });
  });
  return kazaState(userId);
}
