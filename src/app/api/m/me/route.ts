import { isLiteRequest, withUser } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getBadgeCounts, myGroupsToday, myMoney } from "@/lib/queries";

export const GET = withUser(async (user, req) => {
  // Hangi sürümü kullandığı: Lite kullanan yönetici yapılamaz
  const lite = isLiteRequest(req);
  if (user.liteApp !== lite) await getDb().user.update({ where: { id: user.id }, data: { liteApp: lite } }).catch(() => {});
  const [groups, money, badge] = await Promise.all([myGroupsToday(user.id), myMoney(user.id), getBadgeCounts(user.id)]);
  return {
    user: { id: user.id, name: user.name, nameConfirmed: user.nameConfirmed, username: user.username, imageUrl: user.imageUrl },
    badge,
    money,
    groups,
  };
});
