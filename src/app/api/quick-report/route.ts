import { publish } from "@/lib/realtime";
import { OFFLINE_GRACE_MS, submitReading, type ReportChoice } from "@/lib/reading";
import { verifyQuickToken } from "@/lib/token";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string; choice?: ReportChoice; pages?: number; at?: string } | null;
  if (!body?.token || !body.choice || !["all", "min", "none", "pages"].includes(body.choice)) {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const t = await verifyQuickToken(body.token, body.at ? OFFLINE_GRACE_MS : 0);
  if (!t) return Response.json({ error: "Bildirimin süresi dolmuş" }, { status: 401 });
  try {
    // Bildirim butonuna internetsiz basıldıysa işlem anı ile gelir
    const at = body.at ? new Date(body.at) : undefined;
    const { log, rules } = await submitReading(t.userId, t.groupId, { choice: body.choice, pages: body.pages, ...(at && !isNaN(at.getTime()) ? { at, dayKey: t.dayKey } : {}) }, t.dayKey);
    await publish(t.groupId, { type: "refresh", reason: "day" });
    return Response.json({ ok: true, pages: log?.pages ?? 0, required: rules.targetPages });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
