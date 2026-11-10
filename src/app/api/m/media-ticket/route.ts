// Fotoğraf yükleme izni: uygulama fotoğrafı bu adresten aldığı izinle doğrudan Cloudinary'ye yükler
import { mediaTicket } from "@/app/actions";
import { withUser } from "@/lib/api";

export const POST = withUser(async (_user, req) => {
  const { groupId } = (await req.json().catch(() => ({}))) as { groupId?: string };
  try {
    return await mediaTicket(String(groupId ?? ""));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Bir hata oluştu" }, { status: 400 });
  }
});
