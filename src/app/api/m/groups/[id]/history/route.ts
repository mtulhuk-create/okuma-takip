import { withUser } from "@/lib/api";
import { getGroupHistory, parseRange } from "@/lib/history";

export const GET = withUser(async (user, req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const data = await getGroupHistory(id, user.id, parseRange(new URL(req.url).searchParams.get("range")));
  if (!data) return Response.json({ error: "Bu grubun üyesi değilsiniz" }, { status: 403 });
  return data;
});
