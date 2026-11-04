import { withUser } from "@/lib/api";
import { getAdminData } from "@/lib/queries";

export const GET = withUser(async (user, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const data = await getAdminData(id, user.id);
  if (!data) return Response.json({ error: "Bu grubun yöneticisi değilsiniz" }, { status: 403 });
  return data;
});
