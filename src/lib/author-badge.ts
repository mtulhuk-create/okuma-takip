// Bildirimde yazanın görünümü: profil fotoğrafı (yoksa harfli sistem avatarı için baş harf),
// ekip çerçevesi ve seri — yalnızca grup ayarlarında açıksa.
import "server-only";
import { getDb } from "./db";
import { memberStreaks, streakTag } from "./history";
import { avatarInitial } from "./names";
import { teamTiers } from "./rules";

/** Bildirime eklenecek alanlar (FCM veri mesajı ve mesaj akışı; hepsi metin) */
export type AuthorBadge = { authorId: string; avatar: string; initial: string; tier: string; streak: string; streakFull: string };

/** Clerk'in varsayılan (harfli degrade) resmi gerçek fotoğraf sayılmaz: uygulama kendi harfli avatarını çizer */
const realPhoto = (url: string | null | undefined) => (url && !url.includes("eyJ0eXBlIjoiZGVmYXVsdCI") ? url : "");

/** Bir grupta birden çok yazar için (mesaj akışı) */
export async function authorBadges(groupId: string, userIds: string[]): Promise<Map<string, AuthorBadge>> {
  const out = new Map<string, AuthorBadge>();
  const ids = [...new Set(userIds)];
  if (!ids.length) return out;
  const group = await getDb().group.findUnique({
    where: { id: groupId },
    include: { teams: true, members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, name: true, accountName: true, imageUrl: true } } } } },
  });
  if (!group) return out;
  // Çerçeve ve seri yalnızca grup ayarlarında açıksa (teamTiers kapalıyken boş döner)
  const tiers = teamTiers(group);
  const streaks = group.streaksEnabled ? await memberStreaks(group, group.members).catch(() => new Map()) : new Map();
  for (const m of group.members) {
    if (!ids.includes(m.userId)) continue;
    const s = streakTag(streaks.get(m.userId), group.streaksEnabled);
    out.set(m.userId, {
      authorId: m.userId,
      avatar: realPhoto(m.user.imageUrl),
      initial: avatarInitial(m.user),
      tier: (m.teamId && tiers.get(m.teamId)) || "",
      streak: s ? String(s.n) : "",
      streakFull: s?.full ? "1" : "",
    });
  }
  return out;
}

export async function authorBadge(groupId: string, userId: string) {
  return (await authorBadges(groupId, [userId])).get(userId) ?? null;
}
