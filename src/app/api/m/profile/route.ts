import { avatarInitial } from "@/lib/names";
import { withUser } from "@/lib/api";
import { getProfileStats } from "@/lib/queries";

export const GET = withUser(async (user) => ({
  user: { id: user.id, name: user.name, nameConfirmed: user.nameConfirmed, username: user.username, imageUrl: user.imageUrl, initial: avatarInitial(user), email: user.email },
  stats: await getProfileStats(user.id),
}));
