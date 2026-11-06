// Katılmadan önce: gruptaki eserlerle kullanıcının diğer gruplarındaki benzer eserler
import { withUser } from "@/lib/api";
import { findBookMatches } from "@/lib/book-links";

export const GET = withUser(async (user, req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const teamId = new URL(req.url).searchParams.get("teamId");
  return { matches: await findBookMatches(user.id, id, teamId) };
});
