import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50);
  const groupId = url.searchParams.get("groupId") ?? "";
  if (q.length < 2) return Response.json({ users: [] });
  const db = getDb();
  // Kullanıcı araması yalnızca davet için: o grubun yöneticisi olmayan arama yapamaz
  const me = groupId ? await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { role: true, status: true } }) : null;
  if (me?.status !== "ACTIVE" || me.role !== "ADMIN") return Response.json({ users: [] }, { status: 403 });
  const users = await db.user.findMany({
    where: {
      id: { not: userId },
      OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }],
    },
    take: 10,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      imageUrl: true,
      memberships: { where: { groupId }, select: { status: true } },
      invitesReceived: { where: { groupId, status: "PENDING" }, select: { id: true } },
    },
  });
  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      imageUrl: u.imageUrl,
      isMember: u.memberships[0]?.status === "ACTIVE",
      invited: u.invitesReceived.length > 0,
    })),
  });
}
