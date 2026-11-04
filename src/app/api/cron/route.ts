import { runCron } from "@/lib/cron";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const stats = await runCron();
  return Response.json({ ok: true, ...stats });
}
