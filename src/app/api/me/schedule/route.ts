// Mobil uygulamanın (APK) cihazda yerel bildirim planlaması için kullandığı uç nokta.
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { rulesFor } from "@/lib/rules";
import { currentPeriod, periodFor, shiftDayKey } from "@/lib/schedule";
import { signQuickToken } from "@/lib/token";

export async function GET() {
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
      where: { groupId: g.id, userId, dayKey: { in: [cur.dayKey, shiftDayKey(cur.dayKey, 1)] } },
    });
    const reported = new Set(logs.map((l) => l.dayKey));
    const periods = [];
    for (let i = 0; i < 4; i++) {
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
      minPages: rulesFor(g, m).minPages,
      books: rulesFor(g, m).books.map((b) => b.title),
      reminderHours: g.reminderHours,
      eligibleFrom: m.joinedAt.toISOString(),
      periods,
    });
  }
  return Response.json({ groups: result });
}
