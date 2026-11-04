import { withUser } from "@/lib/api";
import { getBadgeCounts, myGroupsToday, myMoney } from "@/lib/queries";

export const GET = withUser(async (user) => {
  const [groups, money, badge] = await Promise.all([myGroupsToday(user.id), myMoney(user.id), getBadgeCounts(user.id)]);
  return {
    user: { id: user.id, name: user.name, username: user.username, imageUrl: user.imageUrl },
    badge,
    money,
    groups: groups.map(({ group, membership, period, open, myLog, reportedCount, memberCount }) => ({
      group: { id: group.id, name: group.name, startMinute: group.startMinute, deadlineMinute: group.deadlineMinute, visibility: group.visibility },
      dailyPages: membership.dailyPages,
      role: membership.role,
      period,
      open,
      myPages: myLog?.pages ?? null,
      reportedCount,
      memberCount,
    })),
  };
});
