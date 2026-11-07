import "server-only";
import type { Group, Prisma } from "@prisma/client";
import { getDb } from "./db";
import { shownName, withShownName } from "./names";
import { activeBadges, finalizeVotes } from "./badges";
import { getDayCards } from "./day";
import { dueView } from "./due-view";
import { currentPeriod, defaultDueAt } from "./schedule";

const PAGE = 40;
const publicUser = { select: { id: true, name: true, accountName: true, imageUrl: true } } as const;

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
  const raw = await db.group.findUnique({
    where: { id: groupId },
    include: { teams: { orderBy: { position: "asc" } }, members: { where: { status: "ACTIVE" }, include: { user: publicUser } } },
  });
  if (!raw) return null;
  // Okuyucu adları grup ayarına göre (girdiği ad / hesap adı / ikisi)
  const group = { ...raw, members: raw.members.map((m) => ({ ...m, user: withShownName(m.user, raw.nameDisplay) })) };
  const me = group.members.find((m) => m.userId === userId);
  if (!me) return { group: { id: group.id, name: group.name }, me: null };
  if (!before) {
    await ensureDayCard(group);
    if (group.badgesEnabled) await finalizeVotes(groupId).catch(() => 0);
  }
  const tags = await activeBadges(group);
  const tag = (uid: string | null | undefined) => (uid ? (tags.get(uid) ?? null) : null);

  const rows = await db.message.findMany({
    where: { groupId, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    include: {
      user: publicUser,
      poll: { include: { options: { orderBy: { position: "asc" }, include: { votes: { include: { user: { select: { id: true, name: true, accountName: true } } } } } } } },
      badge: { include: { user: publicUser, options: { orderBy: { createdAt: "asc" }, include: { votes: { select: { userId: true } } } } } },
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
    user: m.user ? { ...withShownName(m.user, group.nameDisplay), badge: tag(m.user.id) } : null,
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
            names: o.votes.map((v) => shownName(v.user, group.nameDisplay)),
          })),
        }
      : null,
    badge: m.kind === "BADGE" && m.badge ? badgeView(m.badge, m.text, userId, me.role === "ADMIN", group) : null,
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

type BadgeRow = Prisma.BadgeGetPayload<{ include: { user: typeof publicUser; options: { include: { votes: { select: { userId: true } } } } } }>;

/** Sohbetteki rozet kartı: oylama (öneri + oy), kazanıldı ya da kalktı */
function badgeView(b: BadgeRow, event: string | null, userId: string, isAdmin: boolean, group: Pick<Group, "nameDisplay" | "badgesEnabled">) {
  const voting = b.status === "VOTING" && !!b.voteUntil && b.voteUntil > new Date() && group.badgesEnabled;
  const isMe = b.userId === userId;
  return {
    id: b.id,
    event: (event === "AWARD" || event === "END" ? event : "VOTE") as "VOTE" | "AWARD" | "END",
    kind: b.kind,
    status: b.status,
    label: b.label,
    user: { id: b.user.id, name: shownName(b.user, group.nameDisplay), imageUrl: b.user.imageUrl },
    isMe,
    voteUntil: b.voteUntil?.toISOString() ?? null,
    voting,
    voters: b.options.reduce((n, o) => n + o.votes.length, 0),
    options: b.options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: o.votes.length,
      mine: o.votes.some((v) => v.userId === userId),
      canDelete: voting && (isAdmin || o.authorId === userId),
    })),
    canVote: voting && !isMe,
    proposed: b.options.some((o) => o.authorId === userId),
    canRemove: isAdmin && (b.status === "VOTING" || b.status === "ACTIVE"),
  };
}

/**
 * Grup kasası: ödenmemiş (vadeli ya da vadesiz) cezaların toplamı. Yönetici ödemeyi onaylayınca düşer.
 * Kişinin kendi borcu ve ödeme bilgileri de döner.
 */
export async function getGroupCash(group: Pick<Group, "id" | "iban" | "ibanName" | "tzOffset" | "dueOffsetDays">, userId: string) {
  const db = getDb();
  const open = { groupId: group.id, status: { in: ["UNPAID", "IN_DUE"] as ("UNPAID" | "IN_DUE")[] } };
  const [all, mine, due, paid, inDue] = await Promise.all([
    db.penalty.aggregate({ where: open, _sum: { amount: true } }),
    db.penalty.aggregate({ where: { ...open, userId }, _sum: { amount: true } }),
    db.paymentDue.findFirst({ where: { groupId: group.id, userId, status: { in: ["PENDING", "SUBMITTED", "OVERDUE"] } }, orderBy: { dueAt: "asc" } }),
    // Grup kurulduğundan beri kasaya giren (onaylanan) toplam
    db.penalty.aggregate({ where: { groupId: group.id, status: "PAID" }, _sum: { amount: true } }),
    // Vadesi verilmiş (ödeme bekleyen) tutarlar ve en yakın vade
    db.paymentDue.aggregate({ where: { groupId: group.id, status: { in: ["PENDING", "SUBMITTED", "OVERDUE"] } }, _sum: { amount: true }, _min: { dueAt: true }, _count: true }),
  ]);
  return {
    expected: all._sum.amount ?? 0,
    paidTotal: paid._sum.amount ?? 0,
    inDue: inDue._sum.amount ?? 0,
    inDueCount: inDue._count,
    nextDueAt: inDue._min.dueAt?.toISOString() ?? null,
    myDebt: mine._sum.amount ?? 0,
    myDue: due ? dueView(due) : null,
    defaultDueAt: defaultDueAt(group).toISOString(),
    iban: group.iban,
    ibanName: group.ibanName,
  };
}

export type ChatPage = NonNullable<Awaited<ReturnType<typeof getChatPage>>>;
export type ChatMessage = NonNullable<ChatPage["messages"]>[number];
