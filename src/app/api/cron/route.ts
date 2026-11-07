import { timingSafeEqual } from "node:crypto";
import { runCron } from "@/lib/cron";

/** Sabit sürede karşılaştırma (zamanlama saldırılarına karşı) */
function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const stats = await runCron();
  return Response.json({ ok: true, ...stats });
}
