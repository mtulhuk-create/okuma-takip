import { getDayCards } from "@/lib/day";
import { getDb } from "@/lib/db";
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
    // Kart güncellensin: eser bazında okunan sayfa, kefaret ve grubun günlük durumu (üstteki çubuk)
    const day = await dayCounts(t.groupId, t.dayKey, t.userId).catch(() => null);
    return Response.json({ ok: true, pages: log?.pages ?? 0, required: rules.targetPages, unit: rules.readUnit, books: (log?.books as { id: string; pages: number | null }[] | null) ?? [], kefaret: log?.kefaret ?? 0, ...(day ? { day } : {}) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Grubun o günkü durumu: kefaret / okudu / alt sınır / okumadı / bekleyen kişi sayısı */
async function dayCounts(groupId: string, dayKey: string, userId: string) {
  const group = await getDb().group.findUnique({
    where: { id: groupId },
    include: { teams: true, members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, name: true, imageUrl: true } } } } },
  });
  if (!group) return null;
  const { members, ...g } = group;
  const card = (await getDayCards(g, members, [dayKey], userId))[dayKey];
  const kef = card.read.filter((p) => p.kefaret).length;
  return { kef, read: card.read.length - kef, min: card.min.length, none: card.none.length, pending: card.pending.length };
}
