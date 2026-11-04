import { withUser } from "@/lib/api";
import { getGroupsOverview } from "@/lib/queries";

export const GET = withUser(async (user, req) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  return getGroupsOverview(user.id, q);
});
