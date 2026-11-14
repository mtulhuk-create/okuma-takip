import "server-only";
import type { Group, Prisma } from "@prisma/client";
import { getDb } from "./db";
import { shownName, withShownName } from "./names";
import { activeBadges, finalizeVotes } from "./badges";
import { getDayCards } from "./day";
import { memberStreaks, streakTag } from "./history";
import { teamTiers } from "./rules";
import { dueView } from "./due-view";
import { mediaEnabled, mediaView } from "./media";
import { pushLater } from "./fcm";
import { publish } from "./realtime";
import { MIN, currentPeriod, defaultDueAt, openPeriod } from "./schedule";

const PAGE = 40;
const publicUser = { select: { id: true, name: true, accountName: true, imageUrl: true } } as const;

/** Okuma günü başladığında grubun sohbetine gün kartını ekler (zaten varsa dokunmaz). */
// Bu sunucu örneğinde gün kartı mesajı var olduğu bilinen gruplar (her istekte yeniden yazma denemesin)
const ensured = new Set<string>();

export async function ensureDayCard(group: Group, now = new Date()) {
  const p = currentPeriod(now, group);
  const key = `${group.id}:${p.dayKey}`;
  if (ensured.has(key)) return false;
  const res = await getDb().message.createMany({
    data: [{ groupId: group.id, kind: "DAY", dayKey: p.dayKey, createdAt: p.start }],
    skipDuplicates: true,
  });
  if (ensured.size > 5000) ensured.clear();
  ensured.add(key);
  return res.count > 0;
}

/** Yanıtlanan mesajın balonda gösterilen özeti için gereken alanlar */
export const replySelect = { select: { id: true, groupId: true, kind: true, text: true, user: { select: { id: true, name: true, accountName: true } }, poll: { select: { question: true } } } } as const;
type ReplyRow = Prisma.MessageGetPayload<typeof replySelect>;

/** Yanıtlanan mesajın özeti: kim yazdı ve kısa metni (fotoğraf / anket simgeyle) */
export function replyView(r: ReplyRow | null | undefined, nameDisplay: Group["nameDisplay"]) {
  if (!r) return null;
  const text = r.kind === "IMAGE" ? `📷 ${r.text ?? "Fotoğraf"}` : r.kind === "POLL" ? `📊 ${r.poll?.question ?? "Anket"}` : (r.text ?? "");
  return { id: r.id, userId: r.user?.id ?? null, name: r.user ? shownName(r.user, nameDisplay) : "", text: text.slice(0, 140) };
}

/** Yanıtlanacak mesaj: aynı grupta, metin / fotoğraf / anket olmalı (değilse yanıtsız gönderilir) */
export async function replyTarget(id: string, groupId: string) {
  if (!id) return null;
  const r = await getDb().message.findUnique({ where: { id }, ...replySelect });
  return r && r.groupId === groupId && (r.kind === "TEXT" || r.kind === "IMAGE" || r.kind === "POLL") ? r : null;
}

/**
 * Sohbet bu kadar süre sessiz kalınca açık günün kartı en alta taşınır. Konuşma sürerken ya da yeni bitmişken
 * araya girmesin diye uzun tutulur.
 */
export const CARD_SINK_MS = 20 * MIN;

/**
 * Mesajlaşma gün kartını yukarıda bıraktıysa ve sohbet bir süredir sessizse, açık günün kartını
 * bulunduğu yerden alıp sohbetin en altına koyar (herkes için). Kapanmış günlerin kartına dokunulmaz.
 */
export async function sinkDayCard(group: Group, now = new Date()) {
  const p = openPeriod(now, group);
  if (!p) return false;
  const db = getDb();
  const last = await db.message.findFirst({ where: { groupId: group.id }, orderBy: { createdAt: "desc" }, select: { kind: true, dayKey: true, createdAt: true } });
  // En altta zaten bugünün kartı varsa ya da sohbet hâlâ sürüyorsa dokunulmaz
  if (!last || (last.kind === "DAY" && last.dayKey === p.dayKey)) return false;
  if (now.getTime() - last.createdAt.getTime() < CARD_SINK_MS) return false;
  const res = await db.message.updateMany({ where: { groupId: group.id, kind: "DAY", dayKey: p.dayKey, createdAt: { lt: last.createdAt } }, data: { createdAt: now } });
  if (!res.count) return false;
  await publish(group.id, { type: "refresh", reason: "card" });
  return true;
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
  const member = group.members.find((m) => m.userId === userId);
  // Site yöneticisi üye olmadığı grubun sohbetini salt okunur (gözlemci) görebilir: yazamaz, okundu bilgisi bırakmaz
  const observer = !member && !!(await db.user.findUnique({ where: { id: userId }, select: { siteAdmin: true } }))?.siteAdmin;
  if (!member && !observer) return { group: { id: group.id, name: group.name }, me: null };
  const me = member ?? { id: null, role: "MEMBER" as const, lastReadAt: null };
  if (!before) {
    await ensureDayCard(group);
    await sinkDayCard(group).catch(() => false);
    if (group.badgesEnabled) await finalizeVotes(groupId).catch(() => 0);
  }
  const [tags, streaks] = await Promise.all([activeBadges(group), memberStreaks(group, group.members)]);
  const tag = (uid: string | null | undefined) => (uid ? (tags.get(uid) ?? null) : null);
  // Ekip hiyerarşisi çerçevesi (yalnızca bu grup)
  const tiers = teamTiers(group);
  const teamOf = new Map(group.members.map((m) => [m.userId, m.teamId]));
  const tierOf = (uid: string) => {
    const t = teamOf.get(uid);
    return t ? (tiers.get(t) ?? null) : null;
  };

  const rows = await db.message.findMany({
    where: { groupId, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    include: {
      user: publicUser,
      poll: { include: { options: { orderBy: { position: "asc" }, include: { votes: { include: { user: { select: { id: true, name: true, accountName: true } } } } } } } },
      badge: { include: { user: publicUser, options: { orderBy: { createdAt: "asc" }, include: { votes: { select: { userId: true } } } } } },
      reactions: { orderBy: { createdAt: "asc" }, select: { emoji: true, userId: true, user: { select: { name: true, accountName: true } } } },
      replyTo: replySelect,
    },
  });
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE).reverse();
  // Sohbeti açan kişi buraya kadar okumuş sayılır (okundu tikleri ve okunmamış sayısı). Yalnızca yeni mesaj varsa yazılır.
  let myReadAt = me.lastReadAt;
  if (!before && me.id) {
    const newest = rows.find((m) => m.kind !== "DAY" && m.userId !== userId)?.createdAt;
    if (newest && (!myReadAt || newest > myReadAt)) {
      myReadAt = new Date();
      await db.groupMember.update({ where: { id: me.id! }, data: { lastReadAt: myReadAt } });
      // Yazanların tikleri güncellensin
      await publish(groupId, { type: "refresh", reason: "read" });
      // Sohbet başka cihazda okundu: telefondaki mesaj bildirimi kalkar (yanıtı bekletmeden)
      pushLater([userId], { type: "read", groupId });
    }
  }
  const today = currentPeriod(new Date(), group).dayKey;
  const dayKeys = page.filter((m) => m.kind === "DAY" && m.dayKey).map((m) => m.dayKey!);
  // Bugünün kartı sayfada olmasa da (çok mesaj atıldıysa) sohbet başlığındaki kısayol için hesaplanır
  const cards = await getDayCards(group, group.members, before || dayKeys.includes(today) ? dayKeys : [...dayKeys, today], userId);

  const messages = page.map((m) => ({
    id: m.id,
    kind: m.kind,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    user: m.user ? { ...withShownName(m.user, group.nameDisplay), badge: tag(m.user.id), streak: streakTag(streaks.get(m.user.id), group.streaksEnabled), tier: tierOf(m.user.id) } : null,
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
    image: m.kind === "IMAGE" ? mediaView(m) : null,
    reply: replyView(m.replyTo, group.nameDisplay),
    reactions: reactionView(m.reactions, userId, group.nameDisplay),
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
    me: { userId, role: me.role, canPost: !observer && canPost(group, me.role), canPhoto: !observer && canPost(group, me.role) && mediaEnabled(), observer },
    // Sohbet bu kadar sessiz kalınca gün kartı en alta taşınır (istemci süre dolunca sayfayı yeniler)
    cardSinkMs: CARD_SINK_MS,
    // Okundu bilgisi: her üyenin sohbeti en son okuduğu an (bir mesajı, o andan önce yazıldıysa okumuştur)
    reads: before ? null : group.members.map((m) => ({ id: m.userId, name: m.user.name, at: (m.userId === userId ? myReadAt : m.lastReadAt)?.toISOString() ?? null })),
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

/** Mesajdaki ifadeler: ifade başına sayı, benim mi, kimler (çoktan aza) */
function reactionView(list: { emoji: string; userId: string; user: { name: string; accountName: string | null } }[], userId: string, nameDisplay: Group["nameDisplay"]) {
  const map = new Map<string, { emoji: string; count: number; mine: boolean; names: string[] }>();
  for (const r of list) {
    const e = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
    e.count++;
    if (r.userId === userId) e.mine = true;
    e.names.push(shownName(r.user, nameDisplay));
    map.set(r.emoji, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
