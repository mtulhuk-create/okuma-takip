// Sohbet olayları: tarayıcıya Server-Sent Events akışı, mobil için (?once=1) anlık yanıt.
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STREAM_MS = 50_000;
const POLL_MS = 1_200;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id: groupId } = await ctx.params;
  const db = getDb();
  const member = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { status: true } });
  // Site yöneticisi üye olmadığı grubun sohbetini de (gözlemci olarak) izleyebilir
  if (member?.status !== "ACTIVE" && !(await db.user.findUnique({ where: { id: userId }, select: { siteAdmin: true } }))?.siteAdmin) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  let cursor = Number(req.headers.get("last-event-id") ?? url.searchParams.get("after") ?? 0) || 0;
  const fetchNew = () => db.groupEvent.findMany({ where: { groupId, id: { gt: cursor } }, orderBy: { id: "asc" }, take: 50 });

  if (url.searchParams.get("once")) {
    const events = await fetchNew();
    if (events.length) cursor = events.at(-1)!.id;
    return Response.json({ cursor, events: events.map((e) => JSON.parse(e.payload ?? "{}")) });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      send("retry: 1000\n\n");
      const until = Date.now() + STREAM_MS;
      let lastBeat = Date.now();
      while (Date.now() < until && !req.signal.aborted) {
        try {
          for (const e of await fetchNew()) {
            cursor = e.id;
            send(`id: ${e.id}\ndata: ${e.payload}\n\n`);
          }
        } catch {
          break;
        }
        if (Date.now() - lastBeat > 15_000) {
          send(": canlı\n\n");
          lastBeat = Date.now();
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
