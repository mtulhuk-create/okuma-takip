import "server-only";
import type { Group, Team } from "@prisma/client";
import { getDb } from "./db";
import { notifyEach, type PushMessage } from "./notify";
import { rulesFor } from "./rules";
import { formatDayLong, minuteToTime, type Period } from "./schedule";
import { signQuickToken } from "./token";

/** Bildirimdeki hızlı butonlar (uygulamayı açmadan bildirim). Tarayıcı izin verdiği kadarını gösterir. */
export const DAY_ACTIONS = [
  { action: "all", title: "✅ Okudum" },
  { action: "min", title: "☑️ Alt sınırı okudum" },
  { action: "none", title: "❌ Okumadım" },
];

type G = Group & { teams: Team[] };
type M = { userId: string; teamId: string | null };

/** Gün kartının bildirime sığan hali: grup + gün, hedef, kaç kişinin okuduğu, son saat ve 3 buton */
export async function dayCardPush(g: G, m: M, period: Period, opts: { done: number; total: number; prefix?: string; renotify?: boolean }): Promise<PushMessage> {
  const r = rulesFor(g, m);
  const token = await signQuickToken(m.userId, g.id, period.dayKey, period.deadline);
  const books = r.books.length > 1 ? ` · ${r.books.length} eser` : r.books[0]?.title && r.books[0].title !== "Günlük okuma" ? ` · ${r.books[0].title}` : "";
  return {
    title: `${opts.prefix ?? "📖"} ${g.name} · ${formatDayLong(period.dayKey)}`,
    body: `Hedef ${r.targetPages} sf (alt sınır ${r.minPages})${books}\n${opts.done}/${opts.total} kişi okudu · son bildirim ${minuteToTime(g.deadlineMinute)}`,
    tag: `day-${g.id}-${period.dayKey}`,
    renotify: opts.renotify,
    url: `/bildir/${g.id}?t=${encodeURIComponent(token)}`,
    token,
    actions: DAY_ACTIONS,
  };
}

/** Yeni okuma günü başladığında üyelere gün kartı bildirimi (kişi başı günde bir kez) */
export async function sendDayStart(g: G, period: Period) {
  const db = getDb();
  const members = await db.groupMember.findMany({ where: { groupId: g.id, status: "ACTIVE", joinedAt: { lte: period.start } } });
  if (!members.length) return 0;
  const logs = await db.readingLog.findMany({ where: { groupId: g.id, dayKey: period.dayKey }, select: { userId: true, pages: true, minPages: true } });
  const reported = new Set(logs.map((l) => l.userId));
  const sent = new Set((await db.notificationLog.findMany({ where: { groupId: g.id, key: period.dayKey, kind: "DAY" }, select: { userId: true } })).map((a) => a.userId));
  const targets = members.filter((m) => !reported.has(m.userId) && !sent.has(m.userId));
  if (!targets.length) return 0;
  await db.notificationLog.createMany({ data: targets.map((m) => ({ groupId: g.id, userId: m.userId, key: period.dayKey, kind: "DAY" })), skipDuplicates: true });
  const done = logs.filter((l) => l.pages > 0 && l.pages >= l.minPages).length;
  const items = await Promise.all(targets.map(async (m) => ({ userId: m.userId, msg: await dayCardPush(g, m, period, { done, total: members.length }) })));
  await notifyEach(items, { push: true });
  return items.length;
}
