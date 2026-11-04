import { withUser } from "@/lib/api";
import { getProfileStats } from "@/lib/queries";

export const GET = withUser(async (user) => ({
  user: { id: user.id, name: user.name, username: user.username, imageUrl: user.imageUrl, email: user.email },
  stats: await getProfileStats(user.id),
}));
