import "server-only";
import type { Group } from "@prisma/client";
import { getDb } from "./db";
import { getDayCards } from "./day";
import { currentPeriod, defaultDueAt } from "./schedule";

const PAGE = 40;
const publicUser = { select: { id: true, name: true, imageUrl: true } } as const;

/** Okuma günü başladığında grubun sohbetine gün kartını ekler (zaten varsa dokunmaz). */
export async function ensureDayCard(group: Group, now = new Date()) {
  const p = currentPeriod(now, group);
  const res = await getDb().message.createMany({
    data: [{ groupId: group.id, kind: "DAY", dayKey: p.dayKey, createdAt: p.start }],
    skipDuplicates: true,
  });
  return res.count > 0;
}

export function canPost(group: Pick<Group, "chatPolicy">, role: "ADMIN" | "MEMBER") {
  return group.chatPolicy === "ALL" || role === "ADMIN";
}

/** Sohbetin bir sayfası (en yeniden geriye). Gün kartları ve anketler kişiye özel hesaplanır. */
export async function getChatPage(groupId: string, userId: string, before?: Date) {
  const db = getDb();
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { teams: { orderBy: { position: "asc" } }, members: { where: { status: "ACTIVE" }, include: { user: publicUser } } },
  });
  if (!group) return null;
  const me = group.members.find((m) => m.userId === userId);
  if (!me) return { group: { id: group.id, name: group.name }, me: null };
  if (!before) await ensureDayCard(group);

  const rows = await db.message.findMany({
    where: { groupId, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    include: {
      user: publicUser,
      poll: { include: { options: { orderBy: { position: "asc" }, include: { votes: { include: { user: { select: { id: true, name: true } } } } } } } },
    },
  });
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE).reverse();
  const today = currentPeriod(new Date(), group).dayKey;
  const dayKeys = page.filter((m) => m.kind === "DAY" && m.dayKey).map((m) => m.dayKey!);
  // Bugünün kartı sayfada olmasa da (çok mesaj atıldıysa) sohbet başlığındaki kısayol için hesaplanır
  const cards = await getDayCards(group, group.members, before || dayKeys.includes(today) ? dayKeys : [...dayKeys, today], userId);

  const messages = page.map((m) => ({
    id: m.id,
    kind: m.kind,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    user: m.user,
    mine: m.userId === userId,
    day: m.kind === "DAY" && m.dayKey ? cards[m.dayKey] : null,
    poll: m.poll
      ? {
          id: m.poll.id,
          question: m.poll.question,
          multiple: m.poll.multiple,
          voters: new Set(m.poll.options.flatMap((o) => o.votes.map((v) => v.userId))).size,
          options: m.poll.options.map((o) => ({
            id: o.id,
            text: o.text,
            votes: o.votes.length,
            mine: o.votes.some((v) => v.userId === userId),
            names: o.votes.map((v) => v.user.name),
          })),
        }
      : null,
  }));

  const lastEvent = await db.groupEvent.findFirst({ where: { groupId }, orderBy: { id: "desc" }, select: { id: true } });
  const kasa = before ? null : await getGroupCash(group, userId);
  return {
    cursor: lastEvent?.id ?? 0,
    group: {
      id: group.id,
      name: group.name,
      chatPolicy: group.chatPolicy,
      memberCount: group.members.length,
      deadlineMinute: group.deadlineMinute,
      today,
    },
    todayCard: before ? null : (cards[today] ?? null),
    kasa,
    me: { userId, role: me.role, canPost: canPost(group, me.role) },
    messages,
    hasMore,
  };
}

/**
 * Grup kasası: ödenmemiş (vadeli ya da vadesiz) cezaların toplamı. Yönetici ödemeyi onaylayınca düşer.
 * Kişinin kendi borcu ve ödeme bilgileri de döner.
 */
export async function getGroupCash(group: Pick<Group, "id" | "iban" | "ibanName" | "tzOffset" | "dueOffsetDays">, userId: string) {
  const db = getDb();
  const open = { groupId: group.id, status: { in: ["UNPAID", "IN_DUE"] as ("UNPAID" | "IN_DUE")[] } };
  const [all, mine, due] = await Promise.all([
    db.penalty.aggregate({ where: open, _sum: { amount: true } }),
    db.penalty.aggregate({ where: { ...open, userId }, _sum: { amount: true } }),
    db.paymentDue.findFirst({ where: { groupId: group.id, userId, status: { in: ["PENDING", "SUBMITTED"] } }, orderBy: { dueAt: "asc" }, select: { id: true, amount: true, dueAt: true, status: true } }),
  ]);
  return {
    expected: all._sum.amount ?? 0,
    myDebt: mine._sum.amount ?? 0,
    myDue: due ? { ...due, dueAt: due.dueAt.toISOString() } : null,
    defaultDueAt: defaultDueAt(group).toISOString(),
    iban: group.iban,
    ibanName: group.ibanName,
  };
}

export type ChatPage = NonNullable<Awaited<ReturnType<typeof getChatPage>>>;
export type ChatMessage = NonNullable<ChatPage["messages"]>[number];
