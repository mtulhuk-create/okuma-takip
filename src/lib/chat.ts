import "server-only";
import type { Group } from "@prisma/client";
import { getDb } from "./db";
import { getDayCards } from "./day";
import { currentPeriod } from "./schedule";

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
  const dayKeys = page.filter((m) => m.kind === "DAY" && m.dayKey).map((m) => m.dayKey!);
  const cards = await getDayCards(group, group.members, dayKeys, userId);

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
  return {
    cursor: lastEvent?.id ?? 0,
    group: {
      id: group.id,
      name: group.name,
      chatPolicy: group.chatPolicy,
      memberCount: group.members.length,
      deadlineMinute: group.deadlineMinute,
    },
    me: { userId, role: me.role, canPost: canPost(group, me.role) },
    messages,
    hasMore,
  };
}

export type ChatPage = NonNullable<Awaited<ReturnType<typeof getChatPage>>>;
export type ChatMessage = NonNullable<ChatPage["messages"]>[number];
