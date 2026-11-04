import "server-only";
import { getDb } from "./db";
import { currentPeriod, openPeriod } from "./schedule";

export async function myGroupsToday(userId: string) {
  const db = getDb();
  const memberships = await db.groupMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: { group: { include: { _count: { select: { members: { where: { status: "ACTIVE" } } } } } } },
    orderBy: { joinedAt: "asc" },
  });
  const now = new Date();
  return Promise.all(
    memberships.map(async (m) => {
      const period = currentPeriod(now, m.group);
      const open = openPeriod(now, m.group);
      const [myLog, reportedCount] = await Promise.all([
        db.readingLog.findUnique({ where: { groupId_userId_dayKey: { groupId: m.groupId, userId, dayKey: period.dayKey } } }),
        db.readingLog.count({ where: { groupId: m.groupId, dayKey: period.dayKey } }),
      ]);
      return { membership: m, group: m.group, period, open, myLog, reportedCount, memberCount: m.group._count.members };
    }),
  );
}

export async function myMoney(userId: string) {
  const db = getDb();
  const [unpaid, dues] = await Promise.all([
    db.penalty.aggregate({ where: { userId, status: { in: ["UNPAID", "IN_DUE"] } }, _sum: { amount: true } }),
    db.paymentDue.findMany({
      where: { userId, status: { in: ["PENDING", "SUBMITTED"] } },
      include: { group: { select: { name: true, tzOffset: true } } },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  return { unpaidTotal: unpaid._sum.amount ?? 0, dues };
}
