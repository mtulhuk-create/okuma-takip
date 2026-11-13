// Mobil arka plan görevi: kişinin gruplarına başkalarının yazdığı yeni mesajların kısa özeti.
// Oturum yerine imzalı token ile çalışır (yalnızca bu özeti okuyabilir).
import { getDb } from "@/lib/db";
import { shownName } from "@/lib/names";
import { markLabel } from "@/lib/reading";
import { authorBadges } from "@/lib/author-badge";
import { verifyInboxToken } from "@/lib/token";

export const dynamic = "force-dynamic";
const MAX_AGE_MS = 24 * 3_600_000;

export async function GET(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Inbox\s+/i, "");
  const userId = token ? await verifyInboxToken(token) : null;
  if (!userId) return Response.json({ error: "Geçersiz token" }, { status: 401 });
  const url = new URL(req.url);
  const afterParam = new Date(url.searchParams.get("after") ?? "");
  // En fazla son 24 saat
  const after = new Date(Math.max(isNaN(afterParam.getTime()) ? 0 : afterParam.getTime(), Date.now() - MAX_AGE_MS));
  const db = getDb();
  const memberships = await db.groupMember.findMany({ where: { userId, status: "ACTIVE" }, select: { groupId: true, group: { select: { name: true, nameDisplay: true, dayDetails: true } } } });
  if (!memberships.length) return Response.json({ now: new Date().toISOString(), messages: [] });
  const groups = new Map(memberships.map((m) => [m.groupId, m.group]));
  const rows = await db.message.findMany({
    where: { groupId: { in: [...groups.keys()] }, kind: { in: ["TEXT", "POLL", "IMAGE"] }, userId: { not: userId }, createdAt: { gt: after } },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, groupId: true, kind: true, text: true, createdAt: true, userId: true, user: { select: { name: true, accountName: true } }, poll: { select: { question: true } } },
  });
  // Başkalarının okuma işaretlemeleri (okudu / alt sınır / okumadı) de aynı akışta bildirilir
  const marks = await db.readingLog.findMany({
    where: { groupId: { in: [...groups.keys()] }, userId: { not: userId }, updatedAt: { gt: after } },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: { id: true, groupId: true, userId: true, pages: true, requiredPages: true, minPages: true, kefaret: true, unit: true, updatedAt: true, user: { select: { name: true, accountName: true } } },
  });
  // Yazanların avatarı, çerçevesi ve serisi (grup ayarları açıksa); grup başına bir kez hesaplanır
  const authors = new Map<string, Set<string>>();
  for (const x of [...rows, ...marks]) if (x.userId) authors.set(x.groupId, (authors.get(x.groupId) ?? new Set()).add(x.userId));
  const badges = new Map<string, Awaited<ReturnType<typeof authorBadges>>>();
  await Promise.all([...authors].map(async ([gid, ids]) => badges.set(gid, await authorBadges(gid, [...ids]).catch(() => new Map()))));
  const badgeOf = (gid: string, uid: string | null) => (uid ? (badges.get(gid)?.get(uid) ?? {}) : {});
  const markItems = marks.map((l) => {
    const g = groups.get(l.groupId)!;
    return { ...badgeOf(l.groupId, l.userId), id: `mark-${l.id}-${l.updatedAt.getTime()}`, groupId: l.groupId, groupName: g.name, author: shownName(l.user, g.nameDisplay), text: markLabel(l, g.dayDetails), createdAt: l.updatedAt.toISOString() };
  });
  return Response.json({
    now: new Date().toISOString(),
    messages: [...markItems, ...rows.map((m) => {
      const g = groups.get(m.groupId)!;
      return {
        ...badgeOf(m.groupId, m.userId),
        id: m.id,
        groupId: m.groupId,
        groupName: g.name,
        author: m.user ? shownName(m.user, g.nameDisplay) : "",
        text: m.kind === "POLL" ? `📊 ${m.poll?.question ?? "Anket"}` : m.kind === "IMAGE" ? `📷 ${m.text ?? "Fotoğraf"}`.slice(0, 200) : (m.text ?? "").slice(0, 200),
        createdAt: m.createdAt.toISOString(),
      };
    })].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  });
}
