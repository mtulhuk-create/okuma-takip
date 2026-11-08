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
  const first = cu.firstName?.trim();
  const last = cu.lastName?.trim();
  const emailName = cu.primaryEmailAddress?.emailAddress?.split("@")[0];
  const name = [first, last].filter(Boolean).join(" ") || cu.username || emailName || "Okuyucu";
  // Uygulama içi kayıtta ad soyad formda girildi; aksi halde (Google, web kaydı) ilk açılışta sorulur
  const entered = (cu.unsafeMetadata as { nameEntered?: boolean } | undefined)?.nameEntered === true;
  // Hesap adı: Google/e-posta hesabından gelen ad (grup ayarına göre gösterilebilir)
  const accountName = entered ? cu.username || emailName || name : name;
  return db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      name,
      accountName,
      nameConfirmed: entered && !!(first && last),
      username: cu.username ?? null,
      email: cu.primaryEmailAddress?.emailAddress ?? null,
      // Fotoğraf yoksa Clerk'in varsayılan resmi değil, uygulamanın renkli harf avatarı kullanılır
      imageUrl: cu.hasImage ? cu.imageUrl : null,
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

/** "Ad Soyad" doğrulaması: ad ve soyad ayrı alınır, fazla boşluklar temizlenir. */
export function cleanNamePart(v: unknown, label: string) {
  const s = String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < 2) throw new Error(`${label} en az 2 harf olmalı`);
  if (s.length > 40) throw new Error(`${label} en fazla 40 karakter olabilir`);
  if (!/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(s)) throw new Error(`${label} yalnızca harflerden oluşmalı`);
  // Her kelimenin ilk harfi büyük (Türkçe kurallarıyla: i → İ)
  return s.replace(/(^|[ -])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("tr-TR"));
}

/** Kayıtlı adı (ad + soyad) iki parçaya ayırır: son kelime soyad, öncesi ad. */
export function splitFullName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

/**
 * Ad gerçek bir ad soyad gibi mi? En az iki kelime, her kelime en az 2 harf ve yalnızca harf
 * (rakam, alt çizgi, nokta yok). "ahmet123", "sinanaykitt", "a.b_c" gibi takma adlar geçmez.
 */
export function looksLikeFullName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.every((w) => /^[\p{L}][\p{L}\p{M}'-]+$/u.test(w));
}

/** Pencerede yazılan ad: 2-60 karakter, harf ve boşluk; kelime başları büyük */
export function cleanName(v: unknown) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (s.length < 2) throw new Error("Adını yaz (en az 2 harf)");
  if (s.length > 60) throw new Error("Ad en fazla 60 karakter olabilir");
  if (!/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(s)) throw new Error("Ad yalnızca harflerden oluşmalı");
  return s.replace(/(^|[ -])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("tr-TR"));
}
