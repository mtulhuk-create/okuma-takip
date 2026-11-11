import "server-only";
import { getDb } from "./db";

/** Okunmamış sayılan mesaj türleri (gün kartı ve rozet kartı sayılmaz) */
export const CHAT_KINDS = ["TEXT", "POLL", "IMAGE"] as const;

type Membership = { groupId: string; lastReadAt: Date | null; joinedAt: Date };

/** Grup başına okunmamış mesaj sayısı: sohbeti en son okuduğum andan sonra başkalarının yazdıkları */
export async function unreadCounts(userId: string, memberships: Membership[]) {
  const db = getDb();
  const counts = await Promise.all(
    memberships.map((m) =>
      db.message.count({ where: { groupId: m.groupId, kind: { in: [...CHAT_KINDS] }, userId: { not: userId }, createdAt: { gt: m.lastReadAt ?? m.joinedAt } } }),
    ),
  );
  return new Map(memberships.map((m, i) => [m.groupId, counts[i]]));
}

/** Menüdeki rozet: okunmamış mesajı olan grup sayısı */
export async function unreadGroupCount(userId: string) {
  const memberships = await getDb().groupMember.findMany({ where: { userId, status: "ACTIVE" }, select: { groupId: true, lastReadAt: true, joinedAt: true } });
  if (!memberships.length) return 0;
  return [...(await unreadCounts(userId, memberships)).values()].filter((n) => n > 0).length;
}
