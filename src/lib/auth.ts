import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "./db";

/** Giriş yapmış kullanıcıyı veritabanıyla eşitleyip döndürür; yoksa giriş sayfasına yönlendirir. */
export const requireUser = cache(async () => {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const db = getDb();
  const existing = await db.user.findUnique({ where: { id: userId } });
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) redirect("/sign-in");
  const name =
    [cu.firstName, cu.lastName].filter(Boolean).join(" ") ||
    cu.username ||
    cu.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Okuyucu";
  return db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      name,
      username: cu.username ?? null,
      email: cu.primaryEmailAddress?.emailAddress ?? null,
      imageUrl: cu.imageUrl,
    },
    update: {},
  });
});

/** Server action'larda kullanılır: yönlendirme yerine hata fırlatır. */
export async function actionUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Oturum açmanız gerekiyor");
  return requireUser();
}

export async function getMembership(groupId: string, userId: string) {
  return getDb().groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
}

export async function requireAdmin(groupId: string) {
  const user = await actionUser();
  const m = await getMembership(groupId, user.id);
  if (!m || m.status !== "ACTIVE" || m.role !== "ADMIN") throw new Error("Bu işlem için grup yöneticisi olmalısınız");
  return { user, membership: m };
}
