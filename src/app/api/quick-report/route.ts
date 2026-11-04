import { submitReading, type ReportChoice } from "@/lib/reading";
import { verifyQuickToken } from "@/lib/token";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string; choice?: ReportChoice; pages?: number } | null;
  if (!body?.token || !body.choice || !["min", "none", "pages"].includes(body.choice)) {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const t = await verifyQuickToken(body.token);
  if (!t) return Response.json({ error: "Bildirimin süresi dolmuş" }, { status: 401 });
  try {
    const { log, member } = await submitReading(t.userId, t.groupId, body.choice, body.pages, t.dayKey);
    return Response.json({ ok: true, pages: log.pages, required: member.dailyPages });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
