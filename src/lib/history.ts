import "server-only";
import { getDb } from "./db";
import { withShownName } from "./names";
import { teamTiers, categoryOf } from "./rules";
import { currentPeriod, periodFor, shiftDayKey } from "./schedule";

export type HistoryRange = "7d" | "1m" | "3m" | "1y" | "all";
export const RANGES: Record<HistoryRange, { label: string; days: number }> = {
  "7d": { label: "Son 7 gün", days: 7 },
  "1m": { label: "Son 1 ay", days: 30 },
  "3m": { label: "Son 3 ay", days: 90 },
  "1y": { label: "Son 1 yıl", days: 365 },
  all: { label: "Üye olduğumdan beri", days: 730 },
};
export const parseRange = (v: string | null): HistoryRange => (v && v in RANGES ? (v as HistoryRange) : "7d");

/** Günlük durum kodu: r okudu · m alt sınır · n okumadı · p bekleniyor · - üye değildi */
export type Stats = { read: number; min: number; none: number; pages: number };
export type HistoryRow = { start: string; cells: string; stats: Stats };

/** Bugünden geriye kesintisiz okunan (hedef ya da alt sınır) gün sayısı; bugün henüz bildirilmediyse seriyi bozmaz. */
export function streakOf(cells: string) {
  let i = cells.length - 1;
  if (cells[i] === "p") i--;
  let n = 0;
  for (; i >= 0 && (cells[i] === "r" || cells[i] === "k" || cells[i] === "m"); i--) n++;
  return n;
}

/** Bugünden geriye kesintisiz TAM okunan (hedef ya da kefaret) gün sayısı */
export function fullStreakOf(cells: string) {
  let i = cells.length - 1;
  if (cells[i] === "p") i--;
  let n = 0;
  for (; i >= 0 && (cells[i] === "r" || cells[i] === "k"); i--) n++;
  return n;
}

/** Seri rozeti en az bu kadar günden başlar (1–2 gün gösterilmez) */
export const STREAK_MIN = 3;

// Gruptaki üyelerin serileri: sohbet sık yenilendiği için kısa süre bellekte tutulur
const STREAK_DAYS = 120;
const streakCache = new Map<string, { at: number; data: Map<string, { n: number; full: number }> }>();

/** Üyelerin okuma serisi (alt sınır dahil) ve tam okuma serisi; son 120 güne bakılır */
export async function memberStreaks(g: G, members: { userId: string; joinedAt: Date }[]) {
  const now = new Date();
  const endKey = currentPeriod(now, g).dayKey;
  const key = `${g.id}:${endKey}`;
  const hit = streakCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const startKey = shiftDayKey(endKey, -(STREAK_DAYS - 1));
  const logs = await getDb().readingLog.findMany({
    where: { groupId: g.id, dayKey: { gte: startKey } },
    select: { userId: true, dayKey: true, pages: true, requiredPages: true, minPages: true, kefaret: true },
  });
  const data = new Map<string, { n: number; full: number }>();
  for (const m of members) {
    const mine = new Map(logs.filter((l) => l.userId === m.userId).map((l) => [l.dayKey, l]));
    const cells = row(g, m.joinedAt, startKey, endKey, mine, now).cells;
    data.set(m.userId, { n: streakOf(cells), full: fullStreakOf(cells) });
  }
  if (streakCache.size > 500) streakCache.clear();
  streakCache.set(key, { at: Date.now(), data });
  return data;
}

/** Gösterilecek seri: tam seri öncelikli; 3 günden azsa yok */
export function streakTag(s: { n: number; full: number } | undefined) {
  if (!s) return null;
  if (s.full >= STREAK_MIN) return { n: s.full, full: true };
  if (s.n >= STREAK_MIN) return { n: s.n, full: false };
  return null;
}

/** Birden çok satırı gün gün birleştirir: o gün en kötü durum (okumadı > bekleniyor > alt sınır > okudu) */
function combine(rows: HistoryRow[]): HistoryRow {
  const end = rows.reduce((a, r) => {
    const last = shiftDayKey(r.start, r.cells.length - 1);
    return last > a ? last : a;
  }, "0000");
  const start = rows.reduce((a, r) => (r.start < a ? r.start : a), "9999");
  let cells = "";
  const stats: Stats = { read: 0, min: 0, none: 0, pages: rows.reduce((s, r) => s + r.stats.pages, 0) };
  for (let k = start; k <= end; k = shiftDayKey(k, 1)) {
    const day = rows.map((r) => {
      const i = Math.round((Date.parse(k) - Date.parse(r.start)) / 86_400_000);
      return i >= 0 && i < r.cells.length ? r.cells[i] : "-";
    });
    const c = day.includes("n") ? "n" : day.includes("p") ? "p" : day.includes("m") ? "m" : day.includes("k") ? "k" : day.includes("r") ? "r" : "-";
    if (c === "r" || c === "k") stats.read++;
    else if (c === "m") stats.min++;
    else if (c === "n") stats.none++;
    cells += c;
  }
  return { start, cells, stats };
}

type G = { id: string; startMinute: number; deadlineMinute: number; tzOffset: number; reminderHours: number; createdAt: Date };
type Log = { userId: string; dayKey: string; pages: number; requiredPages: number; minPages: number; kefaret?: number };

function row(g: G, joinedAt: Date, startKey: string, endKey: string, logs: Map<string, Log>, now: Date): HistoryRow {
  let cells = "";
  const stats: Stats = { read: 0, min: 0, none: 0, pages: 0 };
  for (let k = startKey; k <= endKey; k = shiftDayKey(k, 1)) {
    const p = periodFor(k, g);
    const log = logs.get(k);
    let c = "-";
    if (log) {
      c = categoryOf(log.pages, { targetPages: log.requiredPages, minPages: log.minPages })[0];
      // k: kefaret okuması (hedefin üstüne ek sayfa)
      if (c === "r" && log.kefaret) c = "k";
      stats.pages += log.pages;
    } else if (joinedAt <= p.start) c = now < p.deadline ? "p" : "n";
    if (c === "r" || c === "k") stats.read++;
    else if (c === "m") stats.min++;
    else if (c === "n") stats.none++;
    cells += c;
  }
  return { start: startKey, cells, stats };
}

function startFor(range: HistoryRange, endKey: string, since: Date, g: G) {
  const sinceKey = currentPeriod(since, g).dayKey;
  const byRange = shiftDayKey(endKey, -(RANGES[range].days - 1));
  return range === "all" ? (sinceKey > byRange ? sinceKey : byRange) : byRange;
}

/** Kullanıcının yalnızca kendi geçmişi: tüm gruplar ve grup grup (+ seçilen aralıktan bağımsız okuma serisi) */
export async function getMyHistory(userId: string, range: HistoryRange) {
  const db = getDb();
  const memberships = await db.groupMember.findMany({ where: { userId, status: "ACTIVE" }, include: { group: { include: { teams: true } } }, orderBy: { joinedAt: "asc" } });
  const now = new Date();
  const plans = memberships.map((m) => {
    const endKey = currentPeriod(now, m.group).dayKey;
    // Seri için üyelik başından (en fazla 2 yıl) itibaren bakılır
    return { m, endKey, startKey: startFor(range, endKey, m.joinedAt, m.group), streakKey: startFor("all", endKey, m.joinedAt, m.group) };
  });
  const minKey = plans.reduce((a, p) => (p.startKey < a ? p.startKey : a), plans.reduce((a, p) => (p.streakKey < a ? p.streakKey : a), "9999"));
  const logs = plans.length
    ? await db.readingLog.findMany({ where: { userId, groupId: { in: plans.map((p) => p.m.groupId) }, dayKey: { gte: minKey } } })
    : [];
  const full: HistoryRow[] = [];
  const groups = plans.map(({ m, endKey, startKey, streakKey }) => {
    const mine = new Map(logs.filter((l) => l.groupId === m.groupId).map((l) => [l.dayKey, l]));
    const long = row(m.group, m.joinedAt, streakKey, endKey, mine, now);
    full.push(long);
    // Ekip çerçevesi gruba özel: yalnızca o grup seçiliyken gösterilir
    const tier = (m.teamId && teamTiers(m.group).get(m.teamId)) || null;
    return { group: { id: m.group.id, name: m.group.name }, ...row(m.group, m.joinedAt, startKey, endKey, mine, now), streak: streakOf(long.cells), fullStreak: fullStreakOf(long.cells), tier };
  });

  const allCells = groups.length ? combine(full).cells : "";
  const all = groups.length ? { ...combine(groups), streak: streakOf(allCells), fullStreak: fullStreakOf(allCells) } : null;
  return { range, all, groups };
}

/** Grup geçmişi: yönetici ya da paylaşım açıksa herkes, değilse yalnızca kendisi */
export async function getGroupHistory(groupId: string, userId: string, range: HistoryRange) {
  const db = getDb();
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { teams: true, members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, name: true, accountName: true, imageUrl: true } } }, orderBy: { joinedAt: "asc" } } },
  });
  const me = group?.members.find((m) => m.userId === userId);
  if (!group || !me) return null;
  const full = group.shareProgress || me.role === "ADMIN";
  const members = full ? group.members : [me];
  const now = new Date();
  const endKey = currentPeriod(now, group).dayKey;
  const startKey = startFor(range, endKey, group.createdAt, group);
  const logs = await db.readingLog.findMany({ where: { groupId, userId: { in: members.map((m) => m.userId) }, dayKey: { gte: startKey } } });
  // Seri ve ekip çerçevesi yalnızca bu gruptaki okumalardan
  const [streaks, tiers] = [await memberStreaks(group, group.members), teamTiers(group)];
  const rows = members.map((m) => {
    const mine = new Map(logs.filter((l) => l.userId === m.userId).map((l) => [l.dayKey, l]));
    return {
      user: withShownName(m.user, group.nameDisplay),
      me: m.userId === userId,
      ...row(group, m.joinedAt, startKey, endKey, mine, now),
      streak: streakTag(streaks.get(m.userId)),
      tier: (m.teamId && tiers.get(m.teamId)) || null,
    };
  });
  return { range, limited: !full, shareProgress: group.shareProgress, rows };
}
