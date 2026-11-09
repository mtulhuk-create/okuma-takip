// Kaza bildirim kartının butonları: oturum yerine imzalı token ile yalnızca kılındı / kaçırıldı ve geri alınmaları
import { applyKaza, kazaState, parseKazaOp } from "@/lib/kaza";
import { verifyKazaToken } from "@/lib/token";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const userId = body?.token ? await verifyKazaToken(body.token) : null;
  if (!userId) return Response.json({ error: "Oturum süresi doldu, uygulamayı açın" }, { status: 401 });
  const op = parseKazaOp(body);
  if (!op || !["make", "undo", "add", "unadd"].includes(op.op)) return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  try {
    return Response.json(await applyKaza(userId, op));
  } catch (e) {
    return Response.json({ error: (e as Error).message, ...(await kazaState(userId)) }, { status: 400 });
  }
}
