// Mobil arka plan görevi: kişinin gruplarına başkalarının yazdığı yeni mesajların kısa özeti.
// Oturum yerine imzalı token ile çalışır (yalnızca bu özeti okuyabilir).
import { getDb } from "@/lib/db";
import { shownName } from "@/lib/names";
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
  const memberships = await db.groupMember.findMany({ where: { userId, status: "ACTIVE" }, select: { groupId: true, group: { select: { name: true, nameDisplay: true } } } });
  if (!memberships.length) return Response.json({ now: new Date().toISOString(), messages: [] });
  const groups = new Map(memberships.map((m) => [m.groupId, m.group]));
  const rows = await db.message.findMany({
    where: { groupId: { in: [...groups.keys()] }, kind: { in: ["TEXT", "POLL", "IMAGE"] }, userId: { not: userId }, createdAt: { gt: after } },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, groupId: true, kind: true, text: true, createdAt: true, user: { select: { name: true, accountName: true } }, poll: { select: { question: true } } },
  });
  return Response.json({
    now: new Date().toISOString(),
    messages: rows.map((m) => {
      const g = groups.get(m.groupId)!;
      return {
        id: m.id,
        groupId: m.groupId,
        groupName: g.name,
        author: m.user ? shownName(m.user, g.nameDisplay) : "",
        text: m.kind === "POLL" ? `📊 ${m.poll?.question ?? "Anket"}` : m.kind === "IMAGE" ? `📷 ${m.text ?? "Fotoğraf"}`.slice(0, 200) : (m.text ?? "").slice(0, 200),
        createdAt: m.createdAt.toISOString(),
      };
    }),
  });
}
