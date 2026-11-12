// Mobil uygulamanın anlık bildirim (Firebase) cihaz kaydı: giriş yapınca kaydedilir, çıkış yapınca silinir
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db";

const read = async (req: Request) => String(((await req.json().catch(() => ({}))) as { token?: unknown }).token ?? "").trim();
const valid = (t: string) => t.length >= 20 && t.length <= 4096;

export const POST = withUser(async (user, req) => {
  const token = await read(req);
  if (!valid(token)) return Response.json({ error: "Geçersiz cihaz kaydı" }, { status: 400 });
  // Aynı telefonda başka hesaba geçildiyse kayıt yeni hesaba taşınır
  await getDb().pushDevice.upsert({ where: { token }, create: { token, userId: user.id }, update: { userId: user.id } });
  return { ok: true };
});

export const DELETE = withUser(async (user, req) => {
  const token = await read(req);
  if (valid(token)) await getDb().pushDevice.deleteMany({ where: { token, userId: user.id } });
  return { ok: true };
});
