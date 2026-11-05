import type { Group, Team } from "@prisma/client";
import { ensureDayCard } from "./chat";
import { getDb } from "./db";
import { groupAdminIds, notifyEach, notifyUsers } from "./notify";
import { publish } from "./realtime";
import { penaltyFor, rulesFor } from "./rules";
import { DAY, MIN, currentPeriod, formatDateTime, formatDayKey, lastClosedPeriod, minuteToTime, openPeriod, periodFor, shiftDayKey } from "./schedule";
import { DAY_ACTIONS, sendDayStart } from "./day-push";
import { processDues } from "./dues";
import { signQuickToken } from "./token";


type G = Group & { teams: Team[] };

/** Son saati geçen ve henüz hesaplanmamış günlerin cezalarını yazar. Sayfa açılışlarında da çağrılır. */
export async function settleGroup(g: G, now = new Date()) {
  const closed = lastClosedPeriod(now, g);
  let next = g.lastSettledDay ? shiftDayKey(g.lastSettledDay, 1) : currentPeriod(g.createdAt, g).dayKey;
  if (closed.dayKey < next) return 0;
  const floor = shiftDayKey(closed.dayKey, -6); // en fazla 7 gün geriye
  if (next < floor) next = floor;
  // Aynı anda iki istek gelirse yalnızca biri hesaplasın
  const claim = await getDb().group.updateMany({ where: { id: g.id, lastSettledDay: g.lastSettledDay }, data: { lastSettledDay: closed.dayKey } });
  if (!claim.count) return 0;
  let total = 0;
  for (let key = next; key <= closed.dayKey; key = shiftDayKey(key, 1)) total += await settleDay(g, key);
  await publish(g.id, { type: "refresh", reason: "day" });
  return total;
}

async function settleDay(g: G, dayKey: string) {
  const db = getDb();
  const period = periodFor(dayKey, g);
  const members = await db.groupMember.findMany({ where: { groupId: g.id, status: "ACTIVE", joinedAt: { lte: period.start } } });
  if (!members.length) return 0;
  const logs = await db.readingLog.findMany({ where: { groupId: g.id, dayKey } });
  const byUser = new Map(logs.map((l) => [l.userId, l]));
  const rows = [];
  for (const m of members) {
    const log = byUser.get(m.userId);
    const r = rulesFor(g, m);
    const rules = log ? { ...r, targetPages: log.requiredPages, minPages: log.minPages } : r;
    const read = log?.pages ?? 0;
    const amount = penaltyFor(rules, read);
    if (amount > 0) rows.push({ groupId: g.id, userId: m.userId, dayKey, amount, pagesRead: read, requiredPages: rules.targetPages });
  }
  if (!rows.length) return 0;
  const res = await db.penalty.createMany({ data: rows, skipDuplicates: true });
  await notifyEach(
    rows.map((r) => ({
      userId: r.userId,
      msg: {
        title: `💸 ${g.name}: ${r.amount} TL ceza`,
        body: `${formatDayKey(dayKey)} için ${r.pagesRead}/${r.requiredPages} sayfa bildirildi.`,
        url: `/gruplar/${g.id}/bilgi`,
        tag: `pen-${g.id}-${dayKey}`,
      },
    })),
    { inApp: true },
  );
  return res.count;
}

export async function runCron(now = new Date()) {
  const stats = { settled: 0, penalties: 0, reminders: 0, countdowns: 0, expired: 0 };
  const db = getDb();
  const groups = await db.group.findMany({ include: { teams: true } });

  for (const g of groups) {
    if (await ensureDayCard(g, now)) await publish(g.id, { type: "refresh", reason: "card" });
    stats.penalties += await settleGroup(g, now);

    // Hatırlatma ve geri sayım (web push)
    const open = openPeriod(now, g);
    if (!open) continue;
    // Yeni gün başladı: gün kartı bildirimi (ilk 3 saat içinde, bir kez)
    if (now.getTime() - open.start.getTime() < 3 * 3_600_000) await sendDayStart(g, open).catch(() => 0);
    const minsLeft = Math.ceil((open.deadline.getTime() - now.getTime()) / MIN);
    let kind: string | null = null;
    if (minsLeft <= 10 && minsLeft >= 1) kind = "CD";
    else if (g.reminderHours > 0 && minsLeft <= g.reminderHours * 60) kind = "REMINDER";
    if (!kind) continue;

    // Gün başladıktan sonra katılanlar da hatırlatılır (ceza yazılmasa da bildirebilirler)
    const members = await db.groupMember.findMany({ where: { groupId: g.id, status: "ACTIVE" } });
    if (!members.length) continue;
    const reported = new Set((await db.readingLog.findMany({ where: { groupId: g.id, dayKey: open.dayKey }, select: { userId: true } })).map((l) => l.userId));
    const sent = new Set((await db.notificationLog.findMany({ where: { groupId: g.id, key: open.dayKey, kind }, select: { userId: true } })).map((a) => a.userId));
    const targets = members.filter((m) => !reported.has(m.userId) && !sent.has(m.userId));
    if (!targets.length) continue;
    await db.notificationLog.createMany({ data: targets.map((m) => ({ groupId: g.id, userId: m.userId, key: open.dayKey, kind: kind! })), skipDuplicates: true });

    const deadlineText = minuteToTime(g.deadlineMinute);
    const items = await Promise.all(
      targets.map(async (m) => {
        const r = rulesFor(g, m);
        const token = await signQuickToken(m.userId, g.id, open.dayKey, open.deadline);
        const msg =
          kind === "REMINDER"
            ? { title: `📚 ${g.name}: okuma hatırlatması`, body: `Bugünkü ${r.targetPages} sayfanı henüz bildirmedin. Son bildirim saati ${deadlineText}.`, tag: `rem-${g.id}` }
            : { title: `⏳ ${minsLeft} dakika kaldı · ${g.name}`, body: `Son bildirim ${deadlineText}. Okuduysan hemen bildir, yoksa ceza yazılacak!`, tag: `cd-${g.id}`, renotify: true };
        return { userId: m.userId, msg: { ...msg, url: `/bildir/${g.id}?t=${encodeURIComponent(token)}`, token, actions: DAY_ACTIONS } };
      }),
    );
    await notifyEach(items);
    if (kind === "REMINDER") stats.reminders += items.length;
    else stats.countdowns += items.length;
  }

  stats.expired = await processDues(now);
  await db.notificationLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY) } } });
  await db.groupEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } });
  return stats;
}

export { processDues } from "./dues";
