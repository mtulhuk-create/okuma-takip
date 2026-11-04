import { withUser } from "@/lib/api";
import { getGroupDetail } from "@/lib/queries";

export const GET = withUser(async (user, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const detail = await getGroupDetail(id, user.id);
  if (!detail) return Response.json({ error: "Grup bulunamadı" }, { status: 404 });
  const { group, me } = detail;
  // Özel gruplar yalnızca üyelere ve davetlilere görünür
  if (!me && group.visibility === "PRIVATE" && !detail.invite) return { private: true, group: { id: group.id, name: group.name } };
  // IBAN yalnızca üyelere gösterilir
  return { ...detail, group: me ? group : { ...group, iban: "", ibanName: "" } };
});
