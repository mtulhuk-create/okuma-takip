// Gruba özel latife rozetleri. Yalnızca o grubun okuma kayıtları esas alınır.
// - İyi rozet ("Maşallah"): 7 gün üst üste tam okuma. Sonraki günlerde herhangi 2 gün tam okunmazsa kalkar.
// - Kötü rozet: 7 gün üst üste tam okuyamama (alt sınır / okumadım / bildirmedi). Adını sohbetteki kartta
//   üyeler önerip oylar (24 saat); eşitlikte rastgele seçilir. Sonraki günlerde herhangi 2 gün tam okunursa kalkar.
import type { Badge, BadgeKind, Group } from "@prisma/client";
import { getDb } from "./db";
import { notifyUsers } from "./notify";
import { publish } from "./realtime";
import { periodFor, shiftDayKey } from "./schedule";

export const GOOD_LABEL = "Maşallah";
export const STREAK_DAYS = 7;
const REMOVE_AFTER = 2;
export const VOTE_MS = 24 * 3_600_000;

export type BadgeTag = { kind: BadgeKind; label: string };

/** Gruptaki etkin rozetler (rozetler kapalıysa boş) */
export async function activeBadges(group: Pick<Group, "id" | "badgesEnabled">) {
  const map = new Map<string, BadgeTag>();
  if (!group.badgesEnabled) return map;
  const rows = await getDb().badge.findMany({ where: { groupId: group.id, status: "ACTIVE" }, select: { userId: true, kind: true, label: true } });
  for (const r of rows) if (r.label) map.set(r.userId, { kind: r.kind, label: r.label });
  return map;
}

/** Rozet önerisi: harflerden oluşan en fazla 2 kelime */
export function cleanBadgeLabel(v: string) {
  const words = v
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1));
  if (!words.length) throw new Error("Rozet adını yaz");
  if (words.length > 2) throw new Error("Rozet en fazla 2 kelime olabilir");
  if (words.some((w) => !/^[\p{L}][\p{L}'’-]*$/u.test(w))) throw new Error("Rozette yalnızca harf kullanılabilir");
  const label = words.join(" ");
  if (label.length > 24) throw new Error("Rozet en fazla 24 harf olabilir");
  return label;
}

async function badgeMessage(groupId: string, badgeId: string, event: "VOTE" | "AWARD" | "END") {
  await getDb().message.create({ data: { groupId, kind: "BADGE", text: event, badgeId } });
}

/**
 * Bir okuma günü kapandıktan sonra çalışır (ceza hesabıyla birlikte): seri tamamlayanlara rozet verir,
 * rozeti olanlarda kaldırma koşulunu kontrol eder.
 */
export async function processBadges(g: Group, upTo: string) {
  if (!g.badgesEnabled) return 0;
  const db = getDb();
  const first = shiftDayKey(upTo, -(STREAK_DAYS - 1));
  const days: string[] = [];
  for (let d = first; d <= upTo; d = shiftDayKey(d, 1)) days.push(d);
  const members = await db.groupMember.findMany({ where: { groupId: g.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } });
  if (!members.length) return 0;
  const [logs, badges] = await Promise.all([
    db.readingLog.findMany({ where: { groupId: g.id, dayKey: { gte: first, lte: upTo } }, select: { userId: true, dayKey: true, pages: true, requiredPages: true } }),
    db.badge.findMany({ where: { groupId: g.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const full = new Set(logs.filter((l) => l.pages > 0 && l.pages >= l.requiredPages).map((l) => `${l.userId}:${l.dayKey}`));
  const firstStart = periodFor(first, g).start;
  let changed = 0;

  for (const m of members) {
    const mine = badges.filter((b) => b.userId === m.userId);
    const current = mine.find((b) => b.status === "ACTIVE" || b.status === "VOTING");
    const isFull = (d: string) => full.has(`${m.userId}:${d}`);

    if (current?.status === "ACTIVE") {
      // Serinin bittiği günden sonraki son 7 gün içinde 2 gün karşıt durum olursa rozet kalkar
      const after = days.filter((d) => d > current.streakDay);
      const opposite = after.filter((d) => (current.kind === "BAD" ? isFull(d) : !isFull(d))).length;
      if (opposite >= REMOVE_AFTER) {
        await endBadge(current, upTo, "ENDED");
        await badgeMessage(g.id, current.id, "END");
        await notifyUsers([m.userId], {
          title: current.kind === "BAD" ? `🎉 ${g.name}: rozetin kalktı` : `${g.name}: Maşallah rozetin kalktı`,
          body: current.kind === "BAD" ? `"${current.label}" rozeti 2 gün tam okuduğun için kalktı.` : "2 gün tam okumadığın için rozet kalktı. 7 gün üst üste tam okuyarak yeniden kazanabilirsin.",
          url: `/gruplar/${g.id}`,
        }).catch(() => {});
        changed++;
      }
      continue;
    }
    if (current) continue; // oylama sürüyor

    // Yeni seri: önceki rozet bittikten sonraki günler ve kişi o günlerin hepsinde üye olmalı
    const ended = mine[0]?.endedDay ?? mine[0]?.streakDay ?? "";
    const since = ended > (g.badgesSince ?? "") ? ended : (g.badgesSince ?? "");
    if (first <= since || m.joinedAt > firstStart) continue;
    const allFull = days.every(isFull);
    const noneFull = days.every((d) => !isFull(d));
    if (!allFull && !noneFull) continue;

    if (allFull) {
      const b = await db.badge.create({ data: { groupId: g.id, userId: m.userId, kind: "GOOD", status: "ACTIVE", label: GOOD_LABEL, streakDay: upTo, awardedAt: new Date() } });
      await badgeMessage(g.id, b.id, "AWARD");
      await notifyUsers([m.userId], { title: `🌟 ${g.name}: Maşallah!`, body: "7 gün üst üste tam okudun, Maşallah rozetini kazandın.", url: `/gruplar/${g.id}` }, { inApp: true }).catch(() => {});
    } else {
      const b = await db.badge.create({ data: { groupId: g.id, userId: m.userId, kind: "BAD", status: "VOTING", streakDay: upTo, voteUntil: new Date(Date.now() + VOTE_MS) } });
      await badgeMessage(g.id, b.id, "VOTE");
      const others = members.filter((x) => x.userId !== m.userId).map((x) => x.userId);
      await notifyUsers(others, { title: `🏷️ ${g.name}: rozet oylaması`, body: `${m.user.name} 7 gündür tam okuyamadı. Sohbette ona latife bir rozet önerin ve oylayın.`, url: `/gruplar/${g.id}` }).catch(() => {});
    }
    changed++;
  }
  return changed;
}

async function endBadge(b: Pick<Badge, "id">, day: string, status: "ENDED" | "CANCELLED") {
  await getDb().badge.update({ where: { id: b.id }, data: { status, endedDay: day, endedAt: new Date() } });
}

/** Süresi dolan oylamaları sonuçlandırır: en çok oy alan şık (eşitlikte rastgele); şık yoksa rozet verilmez. */
export async function finalizeVotes(groupId?: string, now = new Date()) {
  const db = getDb();
  const due = await db.badge.findMany({
    where: { status: "VOTING", voteUntil: { lte: now }, ...(groupId ? { groupId } : {}) },
    include: { options: { include: { _count: { select: { votes: true } } } }, group: { select: { id: true, name: true, lastSettledDay: true } } },
  });
  let n = 0;
  for (const b of due) {
    const day = b.group.lastSettledDay ?? b.streakDay;
    if (!b.options.length) {
      const claim = await db.badge.updateMany({ where: { id: b.id, status: "VOTING" }, data: { status: "CANCELLED", endedDay: day, endedAt: now } });
      if (claim.count) n++;
      continue;
    }
    const max = Math.max(...b.options.map((o) => o._count.votes));
    const top = b.options.filter((o) => o._count.votes === max);
    const pick = top[Math.floor(Math.random() * top.length)];
    const claim = await db.badge.updateMany({ where: { id: b.id, status: "VOTING" }, data: { status: "ACTIVE", label: pick.label, awardedAt: now } });
    if (!claim.count) continue;
    await badgeMessage(b.groupId, b.id, "AWARD");
    await notifyUsers([b.userId], { title: `🏷️ ${b.group.name}: yeni rozetin`, body: `Grup arkadaşların sana "${pick.label}" rozetini seçti. 2 gün tam okursan kalkar.`, url: `/gruplar/${b.groupId}` }, { inApp: true }).catch(() => {});
    await publish(b.groupId, { type: "refresh", reason: "badge" });
    n++;
  }
  return n;
}

/** Rozetler kapatıldığında süren oylamalar ve etkin rozetler sona erer */
export async function closeAllBadges(groupId: string, day: string) {
  await getDb().badge.updateMany({ where: { groupId, status: { in: ["VOTING", "ACTIVE"] } }, data: { status: "CANCELLED", endedDay: day, endedAt: new Date() } });
}
