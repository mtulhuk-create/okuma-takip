import "server-only";
import { activeBadges, type BadgeTag } from "./badges";
import { ensureDayCard } from "./chat";
import { getDayCards } from "./day";
import { maintainLater } from "./maintenance";
import { dueView } from "./due-view";
import { withShownName } from "./names";
import { describePenalty, rulesFor } from "./rules";
import { getDb } from "./db";

// Diğer kullanıcılar hakkında dışarıya yalnızca bu alanlar verilir
const publicUser = { select: { id: true, name: true, username: true, imageUrl: true } } as const;
// Grup içinde gösterilen kullanıcılar: ad, grup ayarına göre (girdiği / hesap adı / ikisi)
const groupUser = { select: { id: true, name: true, accountName: true, username: true, imageUrl: true } } as const;
import { currentPeriod, defaultDueAt, openPeriod, periodFor, shiftDayKey } from "./schedule";

/** Bugün sayfası: her grup için güncel gün kartı ve son 7 günün özeti. */
export async function myGroupsToday(userId: string) {
  const db = getDb();
  const memberships = await db.groupMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      group: {
        include: {
          teams: { orderBy: { position: "asc" } },
          members: { where: { status: "ACTIVE" }, include: { user: groupUser }, orderBy: { joinedAt: "asc" } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  const now = new Date();
  await Promise.all(memberships.map((m) => ensureDayCard(m.group, now)));
  maintainLater(
    memberships.map((m) => m.groupId),
    memberships.map((m) => m.group),
  );
  return Promise.all(
    memberships.map(async (m) => {
      const { members: rawMembers, ...group } = m.group;
      const members = rawMembers.map((x) => ({ ...x, user: withShownName(x.user, group.nameDisplay) }));
      const rules = rulesFor(group, m);
      const period = currentPeriod(now, group);
      const cards = await getDayCards(group, members, [period.dayKey], userId);
      return {
        group: { id: group.id, name: group.name, startMinute: group.startMinute, deadlineMinute: group.deadlineMinute, visibility: group.visibility },
        role: m.role,
        rules,
        period,
        open: openPeriod(now, group),
        card: cards[period.dayKey],
      };
    }),
  );
}

export async function myMoney(userId: string) {
  const db = getDb();
  const [unpaid, dues, byGroup] = await Promise.all([
    db.penalty.aggregate({ where: { userId, status: { in: ["UNPAID", "IN_DUE"] } }, _sum: { amount: true } }),
    db.paymentDue.findMany({
      where: { userId, status: { in: ["PENDING", "SUBMITTED", "OVERDUE"] } },
      include: { group: { select: { name: true, tzOffset: true } } },
      orderBy: { dueAt: "asc" },
    }),
    db.penalty.groupBy({ by: ["groupId"], where: { userId, status: { in: ["UNPAID", "IN_DUE"] } }, _sum: { amount: true } }),
  ]);
  // Grup grup borç ve ödeme bilgileri (Bugün ekranındaki borç penceresi için)
  const groups = byGroup.length
    ? await db.group.findMany({ where: { id: { in: byGroup.map((g) => g.groupId) } }, select: { id: true, name: true, iban: true, ibanName: true } })
    : [];
  const debts = byGroup
    .map((b) => {
      const g = groups.find((x) => x.id === b.groupId)!;
      const due = dues.find((d) => d.groupId === b.groupId);
      return { group: g, amount: b._sum.amount ?? 0, due: due ? dueView(due) : null };
    })
    .filter((d) => d.group && d.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { unpaidTotal: unpaid._sum.amount ?? 0, dues, debts };
}

/** Grup sayfası verisi. Üye değilse yalnızca davet/istek bilgisi döner. */
export async function getGroupDetail(id: string, userId: string) {
  const db = getDb();
  const raw = await db.group.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      teams: { orderBy: { position: "asc" } },
      members: { where: { status: "ACTIVE" }, include: { user: groupUser }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!raw) return null;
  // Rozetler yalnızca grup üyelerine görünür
  const tags = raw.members.some((m) => m.userId === userId) ? await activeBadges(raw) : new Map<string, BadgeTag>();
  const group = { ...raw, members: raw.members.map((m) => ({ ...m, user: withShownName(m.user, raw.nameDisplay), badge: tags.get(m.userId) ?? null })) };
  const me = group.members.find((m) => m.userId === userId) ?? null;
  const myRules = me ? rulesFor(group, me) : null;
  if (!me) {
    const [invite, request] = await Promise.all([
      db.invitation.findFirst({ where: { groupId: id, inviteeId: userId, status: "PENDING" }, include: { inviter: publicUser } }),
      db.joinRequest.findFirst({ where: { groupId: id, userId, status: "PENDING" } }),
    ]);
    return { group, me, myRules, invite, request, teamChange: null, board: null };
  }
  const now = new Date();
  const period = currentPeriod(now, group);
  const open = openPeriod(now, group);
  const days = Array.from({ length: 7 }, (_, i) => shiftDayKey(period.dayKey, i - 6));
  const [logs, penalties, dues, teamChange] = await Promise.all([
    db.readingLog.findMany({ where: { groupId: id, dayKey: { in: days } } }),
    db.penalty.findMany({ where: { groupId: id, userId }, orderBy: { dayKey: "desc" }, take: 30 }),
    db.paymentDue.findMany({ where: { groupId: id, userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.teamChangeRequest.findFirst({ where: { groupId: id, userId, status: "PENDING" }, include: { team: { select: { name: true } } } }),
  ]);
  const dayStarts = Object.fromEntries(days.map((d) => [d, periodFor(d, group).start]));
  return { group, me, myRules, invite: null, request: null, teamChange, board: { period, open, days, dayStarts, logs, penalties, dues } };
}

/** Yönetim sayfası verisi; kullanıcı yönetici değilse null. */
export async function getAdminData(id: string, userId: string) {
  const db = getDb();
  const [group, me] = await Promise.all([
    db.group.findUnique({ where: { id }, include: { teams: { orderBy: { position: "asc" } } } }),
    db.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId } } }),
  ]);
  if (!group || !me || me.status !== "ACTIVE" || me.role !== "ADMIN") return null;
  const [rawMembers, requests, invites, rawDues, rawPenalties, rawChanges] = await Promise.all([
    db.groupMember.findMany({ where: { groupId: id, status: "ACTIVE" }, include: { user: groupUser }, orderBy: { joinedAt: "asc" } }),
    db.joinRequest.findMany({ where: { groupId: id, status: "PENDING" }, include: { user: publicUser }, orderBy: { createdAt: "asc" } }),
    db.invitation.findMany({ where: { groupId: id, status: "PENDING" }, include: { invitee: publicUser } }),
    db.paymentDue.findMany({ where: { groupId: id }, include: { user: groupUser }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 50 }),
    db.penalty.findMany({ where: { groupId: id, status: { in: ["UNPAID", "IN_DUE"] } }, include: { user: groupUser }, orderBy: { dayKey: "desc" } }),
    db.teamChangeRequest.findMany({ where: { groupId: id, status: "PENDING" }, include: { user: groupUser, team: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  // Üyeler grup ayarındaki adla görünür (katılma isteği ve davetlerde girdiği ad)
  const mode = group.nameDisplay;
  const members = rawMembers.map((x) => ({ ...x, user: withShownName(x.user, mode) }));
  const dues = rawDues.map((x) => ({ ...x, user: withShownName(x.user, mode) }));
  const unpaidPenalties = rawPenalties.map((x) => ({ ...x, user: withShownName(x.user, mode) }));
  const teamChanges = rawChanges.map((x) => ({ ...x, user: withShownName(x.user, mode) }));
  const money: Record<string, { unpaid: number; inDue: number }> = {};
  for (const p of unpaidPenalties) {
    const e = (money[p.userId] ??= { unpaid: 0, inDue: 0 });
    if (p.status === "UNPAID") e.unpaid += p.amount;
    else e.inDue += p.amount;
  }
  return { group, members, requests, invites, dues, unpaidPenalties, money, teamChanges, defaultDueAt: defaultDueAt(group) };
}

const teamRules = { id: true, name: true, penaltyMode: true, targetPages: true, minPages: true, penaltyAmount: true, minDiscount: true, books: true } as const;

/** Gruplar sayfası: üye olduğum gruplar (bugünkü durumla) ve keşfedilecek herkese açık gruplar (kurallar ve ekip hedefleriyle) */
export async function getGroupsOverview(userId: string, q: string) {
  const db = getDb();
  const [mine, publicGroups, myRequests] = await Promise.all([
    db.groupMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        group: { include: { _count: { select: { members: { where: { status: "ACTIVE" } } } }, teams: { select: teamRules, orderBy: { position: "asc" } } } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.group.findMany({
      where: {
        visibility: "PUBLIC",
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {}),
      },
      include: {
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
        owner: { select: { name: true } },
        teams: { select: teamRules, orderBy: { position: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.joinRequest.findMany({ where: { userId, status: "PENDING" }, select: { groupId: true } }),
  ]);

  // Bugünkü durum: kaç kişi bildirdi, ben bildirdim mi, grupta borcum
  const now = new Date();
  const periods = new Map(mine.map((m) => [m.groupId, currentPeriod(now, m.group)]));
  const ids = mine.map((m) => m.groupId);
  const [logs, debts, openDues] = ids.length
    ? await Promise.all([
        db.readingLog.findMany({ where: { groupId: { in: ids }, dayKey: { in: [...new Set([...periods.values()].map((p) => p.dayKey))] } }, select: { groupId: true, userId: true, dayKey: true, pages: true, minPages: true } }),
        db.penalty.groupBy({ by: ["groupId"], where: { userId, groupId: { in: ids }, status: { in: ["UNPAID", "IN_DUE"] } }, _sum: { amount: true } }),
        db.paymentDue.findMany({ where: { userId, groupId: { in: ids }, status: { in: ["PENDING", "SUBMITTED", "OVERDUE"] } }, orderBy: { dueAt: "asc" } }),
      ])
    : [[], [], []];
  const today = mine.map((m) => {
    const p = periods.get(m.groupId)!;
    const dayLogs = logs.filter((l) => l.groupId === m.groupId && l.dayKey === p.dayKey);
    const myLog = dayLogs.find((l) => l.userId === userId);
    const rules = rulesFor(m.group, m);
    return {
      groupId: m.groupId,
      dayKey: p.dayKey,
      deadline: p.deadline.toISOString(),
      open: now >= p.start && now < p.deadline,
      reported: dayLogs.filter((l) => l.pages >= l.minPages && l.pages > 0).length,
      myPages: myLog?.pages ?? null,
      myTarget: rules.targetPages,
      myMin: rules.minPages,
      teamName: rules.teamName,
      books: rules.books.map((b) => b.title),
      penalty: describePenalty(rules),
      debt: debts.find((d) => d.groupId === m.groupId)?._sum.amount ?? 0,
      due: (() => {
        const d = openDues.find((x) => x.groupId === m.groupId);
        return d ? dueView(d) : null;
      })(),
    };
  });
  return { mine, today, publicGroups, requestedIds: myRequests.map((r) => r.groupId) };
}

export async function getNotificationsData(userId: string) {
  const db = getDb();
  const [invites, notes] = await Promise.all([
    db.invitation.findMany({
      where: { inviteeId: userId, status: "PENDING" },
      include: {
        group: { include: { _count: { select: { members: { where: { status: "ACTIVE" } } } }, teams: { select: teamRules, orderBy: { position: "asc" } } } },
        inviter: publicUser,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { invites, notes };
}

export async function getProfileStats(userId: string) {
  const db = getDb();
  const [pages, days, penalties, groups] = await Promise.all([
    db.readingLog.aggregate({ where: { userId }, _sum: { pages: true } }),
    db.readingLog.count({ where: { userId, pages: { gt: 0 } } }),
    db.penalty.aggregate({ where: { userId, status: { in: ["PAID", "UNPAID", "IN_DUE"] } }, _sum: { amount: true } }),
    db.groupMember.count({ where: { userId, status: "ACTIVE" } }),
  ]);
  return { totalPages: pages._sum.pages ?? 0, readDays: days, totalPenalty: penalties._sum.amount ?? 0, activeGroups: groups };
}

export async function getBadgeCounts(userId: string) {
  // Davetler de uygulama içi bildirim oluşturur; rozet yalnızca okunmamış bildirimleri sayar
  return getDb().notification.count({ where: { userId, read: false } });
}
