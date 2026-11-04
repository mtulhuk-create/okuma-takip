import { withUser } from "@/lib/api";
import { getNotificationsData } from "@/lib/queries";

export const GET = withUser(async (user) => getNotificationsData(user.id));
