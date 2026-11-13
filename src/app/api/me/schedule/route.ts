// Mobil uygulamanın (APK) cihazda yerel bildirim planlaması için kullandığı uç nokta.
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { rulesFor } from "@/lib/rules";
import { currentPeriod, periodFor, shiftDayKey } from "@/lib/schedule";
import { signQuickToken } from "@/lib/token";

/** ?days=N: kaç okuma günü ileriye planlanacak (tam sürüm 7, Lite 4; varsayılan 4) */
export async function GET(req: Request) {
  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam >= 1 ? Math.min(7, Math.floor(daysParam)) : 4;
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const memberships = await db.groupMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: { group: { include: { teams: true } } },
  });
  const now = new Date();
  const result = [];
  for (const m of memberships) {
    const g = m.group;
    const cur = currentPeriod(now, g);
    const logs = await db.readingLog.findMany({
      where: { groupId: g.id, userId, dayKey: { in: Array.from({ length: days }, (_, i) => shiftDayKey(cur.dayKey, i)) } },
    });
    const reported = new Set(logs.map((l) => l.dayKey));
    const periods = [];
    for (let i = 0; i < days; i++) {
      const p = periodFor(shiftDayKey(cur.dayKey, i), g);
      if (p.deadline <= now) continue;
      periods.push({
        dayKey: p.dayKey,
        start: p.start.toISOString(),
        deadline: p.deadline.toISOString(),
        reported: reported.has(p.dayKey),
        // Token üretilemese de (APP_SECRET eksik) bildirimler planlansın; butonlar o zaman uygulamayı açar
        token: await signQuickToken(userId, g.id, p.dayKey, p.deadline).catch(() => ""),
      });
    }
    result.push({
      groupId: g.id,
      name: g.name,
      dailyPages: rulesFor(g, m).targetPages,
      // Saat hesabında dailyPages / minPages dakikadır
      unit: rulesFor(g, m).readUnit,
      minPages: rulesFor(g, m).minPages,
      books: rulesFor(g, m).books.map((b) => b.title),
      reminderHours: g.reminderHours,
      eligibleFrom: m.joinedAt.toISOString(),
      periods,
    });
  }
  return Response.json({ groups: result });
}
