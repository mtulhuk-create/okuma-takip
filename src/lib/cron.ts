import { getDb } from "./db";
import { groupAdminIds, notifyEach, notifyUsers } from "./notify";
import { DAY, MIN, currentPeriod, formatDateTime, formatDayKey, lastClosedPeriod, minuteToTime, openPeriod, penaltyFor, periodFor, shiftDayKey } from "./schedule";
import { signQuickToken } from "./token";

const QUICK_ACTIONS = [
  { action: "min", title: "✅ Alt sınırı okudum" },
  { action: "none", title: "❌ Okumadım" },
];

export async function runCron(now = new Date()) {
  const stats = { settled: 0, penalties: 0, reminders: 0, countdowns: 0, expired: 0 };
  const db = getDb();
  const groups = await db.group.findMany();

  for (const g of groups) {
    // 1) Son saati geçen günler için ceza hesapla
    const closed = lastClosedPeriod(now, g);
    let next = g.lastSettledDay ? shiftDayKey(g.lastSettledDay, 1) : currentPeriod(g.createdAt, g).dayKey;
    if (closed.dayKey >= next) {
      // en fazla 7 gün geriye git
      const floor = shiftDayKey(closed.dayKey, -6);
      if (next < floor) next = floor;
      for (let key = next; key <= closed.dayKey; key = shiftDayKey(key, 1)) {
        stats.penalties += await settleDay(g, key);
        stats.settled++;
      }
      await db.group.update({ where: { id: g.id }, data: { lastSettledDay: closed.dayKey } });
    }

    // 2) Hatırlatma ve geri sayım
    const open = openPeriod(now, g);
    if (!open) continue;
    const minsLeft = Math.ceil((open.deadline.getTime() - now.getTime()) / MIN);
    let kind: string | null = null;
    if (minsLeft <= 10 && minsLeft >= 1) kind = `CD${minsLeft}`;
    else if (g.reminderHours > 0 && minsLeft <= g.reminderHours * 60) kind = "REMINDER";
    if (!kind) continue;

    const members = await db.groupMember.findMany({
      where: { groupId: g.id, status: "ACTIVE", joinedAt: { lte: open.start } },
    });
    if (!members.length) continue;
    const logs = await db.readingLog.findMany({ where: { groupId: g.id, dayKey: open.dayKey } });
    const reported = new Set(logs.map((l) => l.userId));
    const already = await db.notificationLog.findMany({
      where: { groupId: g.id, key: open.dayKey, kind },
      select: { userId: true },
    });
    const sent = new Set(already.map((a) => a.userId));
    const targets = members.filter((m) => !reported.has(m.userId) && !sent.has(m.userId));
    if (!targets.length) continue;

    await db.notificationLog.createMany({
      data: targets.map((m) => ({ groupId: g.id, userId: m.userId, key: open.dayKey, kind: kind! })),
      skipDuplicates: true,
    });
    const deadlineText = minuteToTime(g.deadlineMinute);
    const items = await Promise.all(
      targets.map(async (m) => {
        const token = await signQuickToken(m.userId, g.id, open.dayKey, open.deadline);
        const url = `/bildir/${g.id}?t=${encodeURIComponent(token)}`;
        const msg =
          kind === "REMINDER"
            ? {
                title: `📚 ${g.name}: okuma hatırlatması`,
                body: `Bugünkü ${m.dailyPages} sayfanı henüz bildirmedin. Son bildirim saati ${deadlineText}.`,
                tag: `rem-${g.id}`,
              }
            : {
                title: `⏳ ${minsLeft} dakika kaldı · ${g.name}`,
                body: `Son bildirim ${deadlineText}. Okuduysan hemen bildir, yoksa ceza yazılacak!`,
                tag: `cd-${g.id}`,
                renotify: minsLeft === 10 || minsLeft <= 2,
              };
        return { userId: m.userId, msg: { ...msg, url, token, actions: QUICK_ACTIONS } };
      }),
    );
    await notifyEach(items);
    if (kind === "REMINDER") stats.reminders += items.length;
    else stats.countdowns += items.length;
  }

  // 3) Ödeme vadeleri
  stats.expired = await processDues(now);

  // 4) Eski kayıtları temizle (saatte bir)
  if (now.getUTCMinutes() === 0) {
    await db.notificationLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY) } } });
  }
  return stats;
}

type G = Awaited<ReturnType<ReturnType<typeof getDb>["group"]["findMany"]>>[number];

async function settleDay(g: G, dayKey: string) {
  const db = getDb();
  const period = periodFor(dayKey, g);
  const members = await db.groupMember.findMany({
    where: { groupId: g.id, status: "ACTIVE", joinedAt: { lte: period.start } },
  });
  if (!members.length) return 0;
  const logs = await db.readingLog.findMany({ where: { groupId: g.id, dayKey } });
  const byUser = new Map(logs.map((l) => [l.userId, l]));
  const rows = [];
  for (const m of members) {
    const log = byUser.get(m.userId);
    const required = log?.requiredPages ?? m.dailyPages;
    const read = log?.pages ?? 0;
    const amount = penaltyFor(g, read, required);
    if (amount > 0) rows.push({ groupId: g.id, userId: m.userId, dayKey, amount, pagesRead: read, requiredPages: required });
  }
  if (!rows.length) return 0;
  const res = await db.penalty.createMany({ data: rows, skipDuplicates: true });
  await notifyEach(
    rows.map((r) => ({
      userId: r.userId,
      msg: {
        title: `💸 ${g.name}: ${r.amount} TL ceza`,
        body: `${formatDayKey(dayKey)} için ${r.pagesRead}/${r.requiredPages} sayfa bildirildi.`,
        url: `/gruplar/${g.id}`,
        tag: `pen-${g.id}-${dayKey}`,
      },
    })),
    { inApp: true },
  );
  return res.count;
}

async function processDues(now: Date) {
  const db = getDb();
  // 24 saat kala hatırlatma
  const soon = await db.paymentDue.findMany({
    where: { status: "PENDING", dueAt: { gt: now, lte: new Date(now.getTime() + DAY) } },
    include: { group: true },
  });
  for (const d of soon) {
    const exists = await db.notificationLog.findUnique({
      where: { groupId_userId_key_kind: { groupId: d.groupId, userId: d.userId, key: d.id, kind: "DUE24" } },
    });
    if (exists) continue;
    await db.notificationLog.create({ data: { groupId: d.groupId, userId: d.userId, key: d.id, kind: "DUE24" } });
    await notifyUsers(
      [d.userId],
      {
        title: `⚠️ Ceza ödemesi için son 24 saat`,
        body: `${d.group.name}: ${d.amount} TL ödemenin vadesi ${formatDateTime(d.dueAt, d.group.tzOffset)}. Ödemezsen gruptan çıkarılacaksın.`,
        url: `/gruplar/${d.groupId}`,
      },
      { inApp: true },
    );
  }

  // Vadesi geçen ve onaylanmayan ödemeler → gruptan at
  const expired = await db.paymentDue.findMany({
    where: { status: { in: ["PENDING", "SUBMITTED"] }, dueAt: { lte: now } },
    include: { group: true, user: true },
  });
  for (const d of expired) {
    await db.paymentDue.update({ where: { id: d.id }, data: { status: "EXPIRED", resolvedAt: now } });
    await db.penalty.updateMany({ where: { dueId: d.id, status: "IN_DUE" }, data: { status: "UNPAID", dueId: null } });
    const member = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: d.groupId, userId: d.userId } } });
    if (member && member.status === "ACTIVE" && member.role !== "ADMIN") {
      await db.groupMember.update({ where: { id: member.id }, data: { status: "KICKED", leftAt: now } });
    }
    await notifyUsers(
      [d.userId],
      {
        title: `🚫 ${d.group.name} grubundan çıkarıldın`,
        body: `${d.amount} TL ceza ödemesi vadesinde onaylanmadı.`,
        url: `/gruplar/${d.groupId}`,
      },
      { inApp: true },
    );
    await notifyUsers(
      (await groupAdminIds(d.groupId)).filter((id) => id !== d.userId),
      {
        title: `${d.group.name}: ${d.user.name} gruptan çıkarıldı`,
        body: `${d.amount} TL ödemenin vadesi doldu.`,
        url: `/gruplar/${d.groupId}/yonetim`,
      },
      { inApp: true },
    );
  }
  return expired.length;
}
