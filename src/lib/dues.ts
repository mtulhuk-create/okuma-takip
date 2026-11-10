import "server-only";
import type { Group } from "@prisma/client";
import { getDb } from "./db";
import { groupAdminIds, notifyUsers } from "./notify";
import { publish } from "./realtime";
import { DAY, formatDateTime } from "./schedule";

/** Vade dolunca yöneticinin karar vermesi için tanınan süre */
export const DECISION_MS = DAY;
const OPEN_DUE = ["PENDING", "SUBMITTED", "OVERDUE"] as const;

/**
 * Grupta aktif yönetici kalmadıysa aktif üyelerden rastgele birini yönetici yapar.
 * Kurucu ayrıldıysa kuruculuk da yeni yöneticiye geçer.
 */
export async function ensureAdmin(groupId: string) {
  const db = getDb();
  const admins = await db.groupMember.count({ where: { groupId, status: "ACTIVE", role: "ADMIN" } });
  if (admins > 0) return null;
  const members = await db.groupMember.findMany({ where: { groupId, status: "ACTIVE" }, include: { user: { select: { name: true, liteApp: true } } } });
  if (!members.length) return null;
  // Lite sürüm kullananlar yönetici yapılmaz (başka üye kalmadıysa mecburen)
  const pool = members.some((m) => !m.user.liteApp) ? members.filter((m) => !m.user.liteApp) : members;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  await db.groupMember.update({ where: { id: pick.id }, data: { role: "ADMIN" } });
  const g = await db.group.findUniqueOrThrow({ where: { id: groupId }, select: { name: true, ownerId: true } });
  const ownerActive = members.some((m) => m.userId === g.ownerId);
  if (!ownerActive) await db.group.update({ where: { id: groupId }, data: { ownerId: pick.userId } });
  await notifyUsers([pick.userId], { title: `👑 ${g.name}: artık yöneticisin`, body: "Grupta yönetici kalmadığı için rastgele seçilerek yönetici yapıldın.", url: `/gruplar/${groupId}/yonetim` }, { inApp: true });
  await notifyUsers(
    members.filter((m) => m.id !== pick.id).map((m) => m.userId),
    { title: g.name, body: `${pick.user.name} grubun yeni yöneticisi oldu.`, url: `/gruplar/${groupId}` },
    { inApp: true },
  );
  await publish(groupId, { type: "refresh", reason: "members" });
  return pick.userId;
}

/** Üyeyi vadesi dolan borcu yüzünden gruptan çıkarır (borcu kasada açık kalır) */
export async function kickForDue(due: { id: string; groupId: string; userId: string; amount: number }, group: Pick<Group, "name">, userName: string, now = new Date()) {
  const db = getDb();
  await db.paymentDue.update({ where: { id: due.id }, data: { status: "EXPIRED", resolvedAt: now, decisionUntil: null } });
  await db.penalty.updateMany({ where: { dueId: due.id, status: "IN_DUE" }, data: { status: "UNPAID", dueId: null } });
  const member = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: due.groupId, userId: due.userId } } });
  if (member?.status === "ACTIVE") await db.groupMember.update({ where: { id: member.id }, data: { status: "KICKED", leftAt: now } });
  await notifyUsers([due.userId], { title: `🚫 ${group.name} grubundan çıkarıldın`, body: `${due.amount} TL ceza ödemesi vadesinde yapılmadı.`, url: "/gruplar" }, { inApp: true });
  await notifyUsers(
    (await groupAdminIds(due.groupId)).filter((id) => id !== due.userId),
    { title: `${group.name}: ${userName} gruptan çıkarıldı`, body: `${due.amount} TL ödemenin vadesi doldu.`, url: `/gruplar/${due.groupId}/yonetim` },
    { inApp: true },
  );
  if (member?.role === "ADMIN") await ensureAdmin(due.groupId);
  await publish(due.groupId, { type: "refresh", reason: "members" });
}

/**
 * Vadeler: 24 saat kala hatırlatma; vade dolunca önce yöneticiye sorulur (ek süre / indirim / çıkar).
 * Karar süresi içinde bir şey yapılmazsa grup ayarı açıksa üye çıkarılır, kapalıysa borç açık kalır.
 */
export async function processDues(now = new Date()) {
  const db = getDb();
  const soon = await db.paymentDue.findMany({ where: { status: "PENDING", dueAt: { gt: now, lte: new Date(now.getTime() + DAY) } }, include: { group: true } });
  for (const d of soon) {
    const log = await db.notificationLog.createMany({ data: [{ groupId: d.groupId, userId: d.userId, key: d.id, kind: d.extensions ? `DUE24-${d.extensions}` : "DUE24" }], skipDuplicates: true });
    if (!log.count) continue;
    await notifyUsers(
      [d.userId],
      {
        title: d.extensions ? "⏳ Ek sürenin son 24 saati" : "⚠️ Ceza ödemesi için son 24 saat",
        body: `${d.group.name}: ${d.amount} TL ödemenin vadesi ${formatDateTime(d.dueAt, d.group.tzOffset)}.${d.group.kickOnExpire ? " Ödenmezse gruptan çıkarılabilirsin." : ""}`,
        url: `/gruplar/${d.groupId}/bilgi`,
      },
      { inApp: true },
    );
  }

  // 1) Vadesi dolanlar → yönetici kararı bekleniyor
  // "Ödedim" bildirilmiş (SUBMITTED) vade yöneticinin onayını bekler: üye, yönetici geç onayladı diye
  // gecikmiş sayılmaz ve gruptan çıkarılmaz. Yalnızca hiç ödeme bildirilmeyen (PENDING) vade dolar.
  const expired = await db.paymentDue.findMany({ where: { status: "PENDING", dueAt: { lte: now } }, include: { group: true, user: true } });
  for (const d of expired) {
    const claim = await db.paymentDue.updateMany({
      where: { id: d.id, status: d.status },
      data: { status: "OVERDUE", decisionUntil: d.group.kickOnExpire ? new Date(now.getTime() + DECISION_MS) : null },
    });
    if (!claim.count) continue;
    const kick = d.group.kickOnExpire;
    await notifyUsers(
      [d.userId],
      {
        title: `⚠️ ${d.group.name}: ödeme vaden doldu`,
        body: `${d.amount} TL kasaya ödenmedi. ${kick ? "Yönetici ek süre verebilir; aksi halde gruptan çıkarılacaksın." : "Borcun açık duruyor."}`,
        url: `/gruplar/${d.groupId}/bilgi`,
      },
      { inApp: true },
    );
    await notifyUsers(
      (await groupAdminIds(d.groupId)).filter((id) => id !== d.userId),
      {
        title: `🧾 ${d.group.name}: ${d.user.name} vadesinde ödemedi`,
        body: `${d.amount} TL. Ek süre ver, indirim yap ya da gruptan çıkar.${kick ? " 24 saat içinde karar verilmezse gruptan çıkarılır." : ""}`,
        url: `/gruplar/${d.groupId}/yonetim?tab=odemeler`,
      },
      { inApp: true },
    );
    await publish(d.groupId, { type: "refresh", reason: "money" });
  }

  // 2) Karar süresi dolanlar → grup ayarı açıksa çıkar
  const undecided = await db.paymentDue.findMany({ where: { status: "OVERDUE", decisionUntil: { lte: now } }, include: { group: true, user: true } });
  for (const d of undecided) {
    if (!d.group.kickOnExpire) {
      await db.paymentDue.update({ where: { id: d.id }, data: { decisionUntil: null } });
      continue;
    }
    await kickForDue(d, d.group, d.user.name, now);
  }
  return expired.length + undecided.length;
}

/** Bir vadeyi uzatır: ilk vade saklanır, ek süre sayısı artar, vade dolmuşsa yeniden bekleyen olur */
export async function extendDue(dueId: string, newDueAt: Date) {
  const db = getDb();
  const due = await db.paymentDue.findUniqueOrThrow({ where: { id: dueId }, include: { group: true } });
  if (!OPEN_DUE.includes(due.status as (typeof OPEN_DUE)[number])) throw new Error("Bu ödeme için ek süre verilemez");
  if (newDueAt.getTime() < Date.now() + 30 * 60_000) throw new Error("Yeni vade en az 30 dakika sonrası olmalı");
  await db.paymentDue.update({
    where: { id: due.id },
    data: {
      dueAt: newDueAt,
      originalDueAt: due.originalDueAt ?? due.dueAt,
      extensions: { increment: 1 },
      status: due.status === "OVERDUE" ? "PENDING" : due.status,
      decisionUntil: null,
    },
  });
  await notifyUsers(
    [due.userId],
    { title: `⏳ ${due.group.name}: ek süre verildi`, body: `${due.amount} TL ödemen için yeni son tarih ${formatDateTime(newDueAt, due.group.tzOffset)}.`, url: `/gruplar/${due.groupId}/bilgi` },
    { inApp: true },
  );
  await publish(due.groupId, { type: "refresh", reason: "money" });
  return due;
}

export type DiscountInput = { groupId: string; userId?: string; penaltyId?: string; mode: "percent" | "amount"; value: number };

/**
 * Ödenmemiş (vadeli ya da vadesiz) cezalarda indirim: tek ceza, bir üyenin tüm cezaları ya da tüm grup.
 * Yüzde her cezaya ayrı uygulanır; TL indirimi kişinin toplam borcundan düşülür (yeni cezalardan başlayarak).
 * Tutarı sıfırlanan ceza affedilmiş sayılır; vadelerin tutarı yeniden hesaplanır, sıfırlanan vade iptal olur.
 */
export async function discountPenalties(input: DiscountInput) {
  const db = getDb();
  const penalties = await db.penalty.findMany({
    where: {
      groupId: input.groupId,
      status: { in: ["UNPAID", "IN_DUE"] },
      ...(input.penaltyId ? { id: input.penaltyId } : input.userId ? { userId: input.userId } : {}),
    },
    include: { due: { select: { status: true } } },
    orderBy: { dayKey: "desc" },
  });
  const open = penalties.filter((p) => !p.due || OPEN_DUE.includes(p.due.status as (typeof OPEN_DUE)[number]));
  if (!open.length) throw new Error("İndirim yapılacak ödenmemiş ceza yok");

  const updates = new Map<string, number>();
  if (input.mode === "percent") {
    for (const p of open) updates.set(p.id, Math.max(0, Math.round((p.amount * (100 - input.value)) / 100)));
  } else {
    const byUser = new Map<string, typeof open>();
    for (const p of open) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p]);
    for (const list of byUser.values()) {
      let left = input.value;
      for (const p of list) {
        if (left <= 0) break;
        const cut = Math.min(p.amount, left);
        updates.set(p.id, p.amount - cut);
        left -= cut;
      }
    }
  }

  let saved = 0;
  const users = new Map<string, number>();
  const dueIds = new Set<string>();
  for (const p of open) {
    const next = updates.get(p.id);
    if (next == null || next === p.amount) continue;
    saved += p.amount - next;
    users.set(p.userId, (users.get(p.userId) ?? 0) + (p.amount - next));
    if (p.dueId) dueIds.add(p.dueId);
    await db.penalty.update({
      where: { id: p.id },
      data: { amount: next, originalAmount: p.originalAmount ?? p.amount, ...(next === 0 ? { status: "WAIVED", dueId: null } : {}) },
    });
  }
  // Vadelerin tutarını yeniden hesapla
  for (const id of dueIds) {
    const sum = await db.penalty.aggregate({ where: { dueId: id, status: "IN_DUE" }, _sum: { amount: true } });
    const amount = sum._sum.amount ?? 0;
    await db.paymentDue.update({ where: { id }, data: amount > 0 ? { amount } : { amount: 0, status: "CANCELLED", resolvedAt: new Date(), decisionUntil: null } });
  }
  const g = await db.group.findUniqueOrThrow({ where: { id: input.groupId }, select: { name: true } });
  for (const [userId, cut] of users) {
    const left = await db.penalty.aggregate({ where: { groupId: input.groupId, userId, status: { in: ["UNPAID", "IN_DUE"] } }, _sum: { amount: true } });
    await notifyUsers(
      [userId],
      { title: `🎁 ${g.name}: cezana indirim`, body: `${cut} TL indirim yapıldı. Kalan borcun ${left._sum.amount ?? 0} TL.`, url: `/gruplar/${input.groupId}/bilgi` },
      { inApp: true },
    );
  }
  await publish(input.groupId, { type: "refresh", reason: "money" });
  return { saved, users: users.size };
}
