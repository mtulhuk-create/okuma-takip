import { publish } from "@/lib/realtime";
import { submitReading, type ReportChoice } from "@/lib/reading";
import { verifyQuickToken } from "@/lib/token";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string; choice?: ReportChoice; pages?: number } | null;
  if (!body?.token || !body.choice || !["all", "min", "none", "pages"].includes(body.choice)) {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const t = await verifyQuickToken(body.token);
  if (!t) return Response.json({ error: "Bildirimin süresi dolmuş" }, { status: 401 });
  try {
    const { log, rules } = await submitReading(t.userId, t.groupId, { choice: body.choice, pages: body.pages }, t.dayKey);
    await publish(t.groupId, { type: "refresh", reason: "day" });
    return Response.json({ ok: true, pages: log.pages, required: rules.targetPages });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
