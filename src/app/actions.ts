"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionUser, getMembership, requireAdmin } from "@/lib/auth";
import { run, str, int, type ActionState } from "@/lib/action-state";
import { getDb } from "@/lib/db";
import { groupAdminIds, notifyUsers } from "@/lib/notify";
import { submitReading, type ReportChoice } from "@/lib/reading";
import { DAY, MIN, formatDateTime, timeToMinute } from "@/lib/schedule";

type Prev = ActionState;

function refresh() {
  revalidatePath("/", "layout");
}

function parseGroupForm(fd: FormData) {
  const name = str(fd, "name", 80);
  if (name.length < 3) throw new Error("Grup adı en az 3 karakter olmalı");
  const startMinute = timeToMinute(str(fd, "startTime"));
  const deadlineMinute = timeToMinute(str(fd, "deadlineTime"));
  if (startMinute === null || deadlineMinute === null) throw new Error("Saatleri SS:DD biçiminde girin");
  const iban = str(fd, "iban", 40).replace(/\s+/g, "").toUpperCase();
  if (iban && !/^TR\d{24}$/.test(iban)) throw new Error("IBAN TR ile başlayan 26 karakter olmalı");
  const penaltyMode = str(fd, "penaltyMode") === "PER_PAGE" ? ("PER_PAGE" as const) : ("FIXED" as const);
  return {
    name,
    description: str(fd, "description", 500) || null,
    visibility: str(fd, "visibility") === "PUBLIC" ? ("PUBLIC" as const) : ("PRIVATE" as const),
    minPages: int(fd, "minPages", 1, 1000, "Alt sınır"),
    penaltyMode,
    penaltyAmount: int(fd, "penaltyAmount", 0, 100000, "Ceza tutarı"),
    iban,
    ibanName: str(fd, "ibanName", 80),
    startMinute,
    deadlineMinute,
    reminderHours: int(fd, "reminderHours", 0, 23, "Uyarı süresi"),
  };
}

// ---------- Grup ----------

export async function createGroup(_: Prev, fd: FormData) {
  let id = "";
  const res = await run(async () => {
    const user = await actionUser();
    const data = parseGroupForm(fd);
    const g = await getDb().group.create({
      data: {
        ...data,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "ADMIN", dailyPages: data.minPages } },
      },
    });
    id = g.id;
  });
  if (res?.ok) {
    refresh();
    redirect(`/gruplar/${id}`);
  }
  return res;
}

export async function updateGroup(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    await requireAdmin(groupId);
    const data = parseGroupForm(fd);
    const db = getDb();
    await db.group.update({ where: { id: groupId }, data });
    // alt sınırın altında kalan üyeleri yükselt
    await db.groupMember.updateMany({ where: { groupId, dailyPages: { lt: data.minPages } }, data: { dailyPages: data.minPages } });
    refresh();
    return "Ayarlar kaydedildi";
  });
}

export async function deleteGroup(_: Prev, fd: FormData) {
  const res = await run(async () => {
    const groupId = str(fd, "groupId");
    const { user } = await requireAdmin(groupId);
    const g = await getDb().group.findUniqueOrThrow({ where: { id: groupId } });
    if (g.ownerId !== user.id) throw new Error("Grubu yalnızca kurucusu silebilir");
    if (str(fd, "confirm") !== g.name) throw new Error("Onay için grup adını aynen yazın");
    await getDb().group.delete({ where: { id: groupId } });
  });
  if (res?.ok) {
    refresh();
    redirect("/gruplar");
  }
  return res;
}

// ---------- Okuma ----------

export async function reportReading(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const choice = str(fd, "choice") as ReportChoice;
    if (!["min", "none", "pages"].includes(choice)) throw new Error("Geçersiz seçim");
    const { log, member } = await submitReading(user.id, str(fd, "groupId"), choice, Number(fd.get("pages")));
    refresh();
    if (log.pages >= member.dailyPages) return `Harika! ${log.pages} sayfa bildirildi 🎉`;
    return `${log.pages} sayfa bildirildi. Hedefin ${member.dailyPages} sayfa — son saate kadar güncelleyebilirsin.`;
  });
}

export async function setDailyPages(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const groupId = str(fd, "groupId");
    const m = await getDb().groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } }, include: { group: true } });
    if (!m || m.status !== "ACTIVE") throw new Error("Bu grubun üyesi değilsiniz");
    const pages = int(fd, "dailyPages", m.group.minPages, 1000, "Günlük sayfa");
    await getDb().groupMember.update({ where: { id: m.id }, data: { dailyPages: pages } });
    refresh();
    return "Günlük hedefin güncellendi";
  });
}

export async function leaveGroup(_: Prev, fd: FormData) {
  const res = await run(async () => {
    const user = await actionUser();
    const groupId = str(fd, "groupId");
    const db = getDb();
    const m = await getMembership(groupId, user.id);
    if (!m || m.status !== "ACTIVE") throw new Error("Zaten üye değilsiniz");
    if (m.role === "ADMIN") {
      const admins = await db.groupMember.count({ where: { groupId, role: "ADMIN", status: "ACTIVE" } });
      if (admins <= 1) throw new Error("Ayrılmadan önce başka bir üyeyi yönetici yapın");
    }
    await db.groupMember.update({ where: { id: m.id }, data: { status: "LEFT", leftAt: new Date() } });
  });
  if (res?.ok) {
    refresh();
    redirect("/gruplar");
  }
  return res;
}

// ---------- Katılım & davet ----------

async function addMember(groupId: string, userId: string) {
  const db = getDb();
  const g = await db.group.findUniqueOrThrow({ where: { id: groupId } });
  await db.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, dailyPages: g.minPages },
    update: { status: "ACTIVE", role: "MEMBER", joinedAt: new Date(), leftAt: null },
  });
  return g;
}

export async function requestJoin(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const groupId = str(fd, "groupId");
    const db = getDb();
    const g = await db.group.findUnique({ where: { id: groupId } });
    if (!g || g.visibility !== "PUBLIC") throw new Error("Bu gruba istek gönderilemez");
    const m = await getMembership(groupId, user.id);
    if (m?.status === "ACTIVE") throw new Error("Zaten üyesiniz");
    const pending = await db.joinRequest.findFirst({ where: { groupId, userId: user.id, status: "PENDING" } });
    if (pending) throw new Error("İsteğiniz zaten beklemede");
    await db.joinRequest.create({ data: { groupId, userId: user.id, message: str(fd, "message", 300) || null } });
    await notifyUsers(
      await groupAdminIds(groupId),
      { title: `🙋 ${g.name}: katılım isteği`, body: `${user.name} gruba katılmak istiyor.`, url: `/gruplar/${groupId}/yonetim` },
      { inApp: true },
    );
    refresh();
    return "Katılım isteği yöneticiye gönderildi";
  });
}

export async function cancelJoinRequest(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    await getDb().joinRequest.updateMany({
      where: { groupId: str(fd, "groupId"), userId: user.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    refresh();
  });
}

export async function respondJoinRequest(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const req = await db.joinRequest.findUniqueOrThrow({ where: { id: str(fd, "requestId") } });
    await requireAdmin(req.groupId);
    if (req.status !== "PENDING") throw new Error("İstek zaten yanıtlanmış");
    const accept = str(fd, "accept") === "1";
    await db.joinRequest.update({ where: { id: req.id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
    const g = accept ? await addMember(req.groupId, req.userId) : await db.group.findUniqueOrThrow({ where: { id: req.groupId } });
    await notifyUsers(
      [req.userId],
      accept
        ? { title: `🎉 ${g.name} grubuna kabul edildin`, body: `Günlük hedefin ${g.minPages} sayfa. Grubun sayfasından değiştirebilirsin.`, url: `/gruplar/${g.id}` }
        : { title: `${g.name}`, body: "Katılım isteğin reddedildi.", url: "/gruplar" },
      { inApp: true },
    );
    refresh();
    return accept ? "Üye kabul edildi" : "İstek reddedildi";
  });
}

export async function inviteUser(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    const { user } = await requireAdmin(groupId);
    const inviteeId = str(fd, "userId");
    const db = getDb();
    const invitee = await db.user.findUnique({ where: { id: inviteeId } });
    if (!invitee) throw new Error("Kullanıcı bulunamadı");
    const m = await getMembership(groupId, inviteeId);
    if (m?.status === "ACTIVE") throw new Error("Kullanıcı zaten üye");
    const existing = await db.invitation.findFirst({ where: { groupId, inviteeId, status: "PENDING" } });
    if (existing) throw new Error("Bu kullanıcı zaten davet edildi");
    const g = await db.group.findUniqueOrThrow({ where: { id: groupId } });
    await db.invitation.create({ data: { groupId, inviterId: user.id, inviteeId } });
    await notifyUsers(
      [inviteeId],
      { title: `📩 ${g.name} grubuna davet edildin`, body: `${user.name} seni okuma grubuna davet etti.`, url: "/bildirimler" },
      { inApp: true },
    );
    refresh();
    return `${invitee.name} davet edildi`;
  });
}

export async function cancelInvite(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const inv = await db.invitation.findUniqueOrThrow({ where: { id: str(fd, "inviteId") } });
    await requireAdmin(inv.groupId);
    await db.invitation.update({ where: { id: inv.id }, data: { status: "CANCELLED" } });
    refresh();
  });
}

export async function respondInvite(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const db = getDb();
    const inv = await db.invitation.findUniqueOrThrow({ where: { id: str(fd, "inviteId") } });
    if (inv.inviteeId !== user.id || inv.status !== "PENDING") throw new Error("Davet geçerli değil");
    const accept = str(fd, "accept") === "1";
    await db.invitation.update({ where: { id: inv.id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
    if (accept) {
      const g = await addMember(inv.groupId, user.id);
      await db.joinRequest.updateMany({ where: { groupId: g.id, userId: user.id, status: "PENDING" }, data: { status: "ACCEPTED" } });
      await notifyUsers(await groupAdminIds(g.id), { title: `${g.name}`, body: `${user.name} davetini kabul etti.`, url: `/gruplar/${g.id}` }, { inApp: true });
    }
    refresh();
    return accept ? "Gruba katıldın 🎉" : "Davet reddedildi";
  });
}

// ---------- Üye yönetimi ----------

export async function removeMember(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const m = await db.groupMember.findUniqueOrThrow({ where: { id: str(fd, "memberId") }, include: { group: true } });
    const { user } = await requireAdmin(m.groupId);
    if (m.userId === user.id) throw new Error("Kendinizi çıkaramazsınız");
    if (m.userId === m.group.ownerId) throw new Error("Grup kurucusu çıkarılamaz");
    await db.groupMember.update({ where: { id: m.id }, data: { status: "REMOVED", leftAt: new Date() } });
    await notifyUsers([m.userId], { title: m.group.name, body: "Yönetici seni gruptan çıkardı.", url: "/gruplar" }, { inApp: true });
    refresh();
    return "Üye çıkarıldı";
  });
}

export async function toggleAdmin(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const m = await db.groupMember.findUniqueOrThrow({ where: { id: str(fd, "memberId") }, include: { group: true } });
    await requireAdmin(m.groupId);
    if (m.userId === m.group.ownerId) throw new Error("Kurucunun yetkisi değiştirilemez");
    const role = m.role === "ADMIN" ? "MEMBER" : "ADMIN";
    await db.groupMember.update({ where: { id: m.id }, data: { role } });
    refresh();
    return role === "ADMIN" ? "Yönetici yapıldı" : "Yöneticilik alındı";
  });
}

// ---------- Ceza & ödeme ----------

/** datetime-local değerini grubun saat dilimine göre çevirir */
function parseLocalDateTime(value: string, tzOffset: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error("Geçerli bir vade tarihi seçin");
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - tzOffset * MIN);
}

export async function createDue(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    const userId = str(fd, "userId");
    await requireAdmin(groupId);
    const db = getDb();
    const g = await db.group.findUniqueOrThrow({ where: { id: groupId } });
    const dueAt = parseLocalDateTime(str(fd, "dueAt"), g.tzOffset);
    if (dueAt.getTime() < Date.now() + 30 * MIN) throw new Error("Vade en az 30 dakika sonrası olmalı");
    const penalties = await db.penalty.findMany({ where: { groupId, userId, status: "UNPAID" } });
    if (!penalties.length) throw new Error("Bu üyenin ödenmemiş cezası yok");
    if (!g.iban) throw new Error("Önce grup ayarlarından IBAN girin");
    const amount = penalties.reduce((s, p) => s + p.amount, 0);
    const due = await db.paymentDue.create({ data: { groupId, userId, amount, dueAt } });
    await db.penalty.updateMany({ where: { id: { in: penalties.map((p) => p.id) } }, data: { status: "IN_DUE", dueId: due.id } });
    if (dueAt.getTime() - Date.now() <= DAY) {
      await db.notificationLog.create({ data: { groupId, userId, key: due.id, kind: "DUE24" } });
    }
    await notifyUsers(
      [userId],
      {
        title: `🧾 ${g.name}: ${amount} TL ceza ödemesi`,
        body: `${formatDateTime(dueAt, g.tzOffset)} tarihine kadar IBAN'a ödeyip "Ödedim" de. Onaylanmazsa gruptan çıkarılırsın.`,
        url: `/gruplar/${groupId}`,
      },
      { inApp: true },
    );
    refresh();
    return `${amount} TL için vade oluşturuldu`;
  });
}

export async function submitPayment(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const db = getDb();
    const due = await db.paymentDue.findUniqueOrThrow({ where: { id: str(fd, "dueId") }, include: { group: true } });
    if (due.userId !== user.id) throw new Error("Bu ödeme size ait değil");
    if (due.status !== "PENDING") throw new Error("Bu ödeme için işlem yapılamaz");
    if (due.dueAt < new Date()) throw new Error("Vade dolmuş");
    await db.paymentDue.update({
      where: { id: due.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), paymentNote: str(fd, "note", 300) || null },
    });
    await notifyUsers(
      (await groupAdminIds(due.groupId)).filter((id) => id !== user.id),
      { title: `💳 ${due.group.name}: ödeme bildirimi`, body: `${user.name} ${due.amount} TL ödediğini bildirdi. Onayınız bekleniyor.`, url: `/gruplar/${due.groupId}/yonetim` },
      { inApp: true },
    );
    refresh();
    return "Ödeme bildirildi, yönetici onayı bekleniyor";
  });
}

export async function resolvePayment(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const due = await db.paymentDue.findUniqueOrThrow({ where: { id: str(fd, "dueId") }, include: { group: true } });
    await requireAdmin(due.groupId);
    const decision = str(fd, "decision");
    if (decision === "confirm") {
      if (!["PENDING", "SUBMITTED"].includes(due.status)) throw new Error("Bu ödeme onaylanamaz");
      await db.paymentDue.update({ where: { id: due.id }, data: { status: "CONFIRMED", resolvedAt: new Date() } });
      await db.penalty.updateMany({ where: { dueId: due.id }, data: { status: "PAID" } });
      await notifyUsers([due.userId], { title: `✅ ${due.group.name}`, body: `${due.amount} TL ödemen onaylandı. Teşekkürler!`, url: `/gruplar/${due.groupId}` }, { inApp: true });
      refresh();
      return "Ödeme onaylandı";
    }
    if (decision === "reject") {
      if (due.status !== "SUBMITTED") throw new Error("Reddedilecek bir ödeme bildirimi yok");
      await db.paymentDue.update({ where: { id: due.id }, data: { status: "PENDING", submittedAt: null } });
      await notifyUsers(
        [due.userId],
        { title: `⚠️ ${due.group.name}`, body: `Ödemen yönetici tarafından görülmedi/onaylanmadı. Vade: ${formatDateTime(due.dueAt, due.group.tzOffset)}.`, url: `/gruplar/${due.groupId}` },
        { inApp: true },
      );
      refresh();
      return "Ödeme bildirimi reddedildi";
    }
    if (decision === "cancel") {
      if (!["PENDING", "SUBMITTED"].includes(due.status)) throw new Error("Bu vade iptal edilemez");
      await db.paymentDue.update({ where: { id: due.id }, data: { status: "CANCELLED", resolvedAt: new Date() } });
      await db.penalty.updateMany({ where: { dueId: due.id }, data: { status: "UNPAID", dueId: null } });
      await notifyUsers([due.userId], { title: due.group.name, body: "Ceza ödeme vaden iptal edildi.", url: `/gruplar/${due.groupId}` }, { inApp: true });
      refresh();
      return "Vade iptal edildi";
    }
    throw new Error("Geçersiz işlem");
  });
}

export async function waivePenalty(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const p = await db.penalty.findUniqueOrThrow({ where: { id: str(fd, "penaltyId") } });
    await requireAdmin(p.groupId);
    if (p.status !== "UNPAID") throw new Error("Yalnızca vadesi oluşturulmamış cezalar affedilebilir");
    await db.penalty.update({ where: { id: p.id }, data: { status: "WAIVED" } });
    refresh();
    return "Ceza affedildi";
  });
}

export async function markAllRead(_: Prev, _fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    await getDb().notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    refresh();
  });
}
