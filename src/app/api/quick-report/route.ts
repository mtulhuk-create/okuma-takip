import { publish } from "@/lib/realtime";
import { OFFLINE_GRACE_MS, submitReading, type ReportChoice } from "@/lib/reading";
import { verifyQuickToken } from "@/lib/token";

export async function POST(req: Request) {
  // bookId + bookChoice: tek eser (kilit ekranı kartındaki eser butonları); toggle: aynı seçim geri alınır
  const body = (await req.json().catch(() => null)) as { token?: string; choice?: ReportChoice; pages?: number; at?: string; bookId?: string; bookChoice?: string; toggle?: boolean } | null;
  if (!body?.token || !body.choice || !["all", "min", "none", "pages", "kefaret"].includes(body.choice)) {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const t = await verifyQuickToken(body.token, body.at ? OFFLINE_GRACE_MS : 0);
  if (!t) return Response.json({ error: "Bildirimin süresi dolmuş" }, { status: 401 });
  try {
    // Bildirim butonuna internetsiz basıldıysa işlem anı ile gelir
    const at = body.at ? new Date(body.at) : undefined;
    const bookChoice = body.bookChoice === "read" || body.bookChoice === "min" || body.bookChoice === "none" ? body.bookChoice : undefined;
    const { log, rules } = await submitReading(
      t.userId,
      t.groupId,
      {
        choice: body.choice,
        pages: body.pages,
        ...(body.bookId && bookChoice ? { bookId: String(body.bookId), bookChoice } : {}),
        toggle: body.toggle === true,
        ...(at && !isNaN(at.getTime()) ? { at, dayKey: t.dayKey } : {}),
      },
      t.dayKey,
    );
    await publish(t.groupId, { type: "refresh", reason: "day" });
    // Kart güncellensin: eser bazında okunan sayfa ve kefaret
    return Response.json({ ok: true, pages: log?.pages ?? 0, required: rules.targetPages, books: (log?.books as { id: string; pages: number | null }[] | null) ?? [], kefaret: log?.kefaret ?? 0 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
