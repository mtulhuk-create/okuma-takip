// Namaz kaza takibi (mobil): durum ve işlemler
import { withUser } from "@/lib/api";
import { applyKaza, kazaState, parseKazaOp } from "@/lib/kaza";
import { signKazaToken } from "@/lib/token";

/** token: bildirim kartındaki butonlar için (uygulama açılmadan kaza bildirir) */
export const GET = withUser(async (user) => ({ ...(await kazaState(user.id)), token: await signKazaToken(user.id).catch(() => "") }));

export const POST = withUser(async (user, req) => {
  const op = parseKazaOp(await req.json().catch(() => null));
  if (!op) return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  try {
    return await applyKaza(user.id, op);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
});
