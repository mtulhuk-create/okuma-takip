import { withUser } from "@/lib/api";
import { getChatPage } from "@/lib/chat";

export const GET = withUser(async (user, req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const before = new URL(req.url).searchParams.get("before");
  const page = await getChatPage(id, user.id, before ? new Date(before) : undefined);
  if (!page) return Response.json({ error: "Grup bulunamadı" }, { status: 404 });
  if (!page.me) return Response.json({ error: "Bu grubun üyesi değilsiniz" }, { status: 403 });
  return page;
});
