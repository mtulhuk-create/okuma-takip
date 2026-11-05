// Profildeki "Deneme bildirimi gönder": bu kullanıcının cihazlarına gün kartı bildirimi gönderir.
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { dayCardPush } from "@/lib/day-push";
import { notifyUsers } from "@/lib/notify";
import { openPeriod } from "@/lib/schedule";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const subs = await db.pushSubscription.count({ where: { userId } });
  if (!subs) return Response.json({ error: "Bu hesapta kayıtlı bildirim aboneliği yok. Önce bildirimleri aç." }, { status: 400 });
  const now = new Date();
  const memberships = await db.groupMember.findMany({ where: { userId, status: "ACTIVE" }, include: { group: { include: { teams: true } } } });
  for (const m of memberships) {
    const period = openPeriod(now, m.group);
    if (!period) continue;
    const [total, logs] = await Promise.all([
      db.groupMember.count({ where: { groupId: m.groupId, status: "ACTIVE" } }),
      db.readingLog.findMany({ where: { groupId: m.groupId, dayKey: period.dayKey }, select: { pages: true, minPages: true } }),
    ]);
    const done = logs.filter((l) => l.pages > 0 && l.pages >= l.minPages).length;
    await notifyUsers([userId], { ...(await dayCardPush(m.group, m, period, { done, total })), renotify: true });
    return Response.json({ ok: true, devices: subs });
  }
  await notifyUsers([userId], { title: "🔔 Okuma Takip", body: "Bildirimler çalışıyor. Okuma günü başlayınca gün kartı burada butonlarıyla görünecek.", url: "/panel" });
  return Response.json({ ok: true, devices: subs });
}
