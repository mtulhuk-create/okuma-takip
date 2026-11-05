import { withUser } from "@/lib/api";
import { getMyHistory, parseRange } from "@/lib/history";

export const GET = withUser(async (user, req) => getMyHistory(user.id, parseRange(new URL(req.url).searchParams.get("range"))));
