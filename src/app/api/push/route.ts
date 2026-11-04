import { auth } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  await requireUser();
  const sub = (await req.json()) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return new Response("Bad request", { status: 400 });
  await getDb().pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (endpoint) await getDb().pushSubscription.deleteMany({ where: { endpoint, userId } });
  return Response.json({ ok: true });
}
