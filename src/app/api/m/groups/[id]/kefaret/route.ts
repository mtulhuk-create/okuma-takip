// Yönetici: kefaret okuması önizlemesi (?discount=50&raise=50&userId=) ve süren planlar
import { withUser } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MAX_DAYS, previewKefaret } from "@/lib/kefaret";
import { shownName } from "@/lib/names";

const clamp = (v: string | null, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};

export const GET = withUser(async (_user, req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    await requireAdmin(id);
  } catch {
    return Response.json({ error: "Yalnızca yönetici görebilir" }, { status: 403 });
  }
  const url = new URL(req.url);
  const discount = clamp(url.searchParams.get("discount"), 1, 100, 50);
  const raise = clamp(url.searchParams.get("raise"), 5, 300, 50);
  const { group, pageValue, rows } = await previewKefaret(id, discount, raise, url.searchParams.get("userId") || undefined);
  const plans = await getDb().kefaretPlan.findMany({
    where: { groupId: id, status: { in: ["ACTIVE", "DONE"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: { user: { select: { name: true, accountName: true } } },
  });
  return {
    discount,
    raise,
    maxDays: MAX_DAYS,
    pageValue: Math.round(pageValue * 100) / 100,
    rows,
    plans: plans.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: shownName(p.user, group.nameDisplay),
      status: p.status,
      discountPercent: p.discountPercent,
      raisePercent: p.raisePercent,
      discountTotal: p.discountTotal,
      earned: p.earned,
      pages: p.pages,
      dailyExtra: p.dailyExtra,
      days: p.days,
      doneDays: p.doneDays,
      startDay: p.startDay,
    })),
  };
});
