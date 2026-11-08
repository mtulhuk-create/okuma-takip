"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionUser, cleanName, getMembership, requireAdmin } from "@/lib/auth";
import { avatarInitial, chooseName, shownName } from "@/lib/names";
import { activeBadges, cleanBadgeLabel, closeAllBadges } from "@/lib/badges";
import { cancelKefaret, startKefaret } from "@/lib/kefaret";
import { run, str, int, type ActionState } from "@/lib/action-state";
import { getDb } from "@/lib/db";
import { parseLinks, saveBookLinks } from "@/lib/book-links";
import { isCatalogBook } from "@/lib/catalog";
import { discountPenalties, ensureAdmin, extendDue, kickForDue } from "@/lib/dues";
import { groupAdminIds, notifyUsers } from "@/lib/notify";
import { canPost } from "@/lib/chat";
import { booksOf, teamsActive } from "@/lib/rules";
import { publish } from "@/lib/realtime";
import { submitReading, type ReportChoice } from "@/lib/reading";
import { DAY, MIN, formatDateTime, timeToMinute } from "@/lib/schedule";

type Prev = ActionState;

function refresh() {
  revalidatePath("/", "layout");
}

type BookInput = { id: string; title: string; targetPages: number; minPages: number };
type RulesInput = { penaltyMode: "FIXED" | "PER_PAGE"; targetPages: number; minPages: number; penaltyAmount: number; minDiscount: number; books: BookInput[] };

function validateRules(r: Record<string, unknown>, label = "", keepTitles?: Set<string>): RulesInput {
  const num = (v: unknown, min: number, max: number, name: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}${name} ${min}-${max} arasında olmalı`);
    return n;
  };
  const penaltyMode = r.penaltyMode === "PER_PAGE" ? ("PER_PAGE" as const) : ("FIXED" as const);
  let rawBooks: Record<string, unknown>[] = [];
  try {
    rawBooks = Array.isArray(r.books) ? r.books : typeof r.books === "string" ? JSON.parse(r.books) : [];
  } catch {}
  // Adı boş bırakılmış fazladan eser satırları yok sayılır; hiç adlı eser yoksa uyarılır
  const named = rawBooks.filter((b) => String(b.title ?? "").trim());
  if (rawBooks.length && !named.length) throw new Error(`${label}En az bir eserin adını yazın`);
  const books: BookInput[] = named.slice(0, 10).map((b) => {
    const title = String(b.title ?? "").trim().slice(0, 80);
    // Yalnızca katalogdaki eserler (eski gruplarda kayıtlı olan ad aynen kalabilir)
    if (!isCatalogBook(title) && !keepTitles?.has(title)) throw new Error(`${label}"${title}" listede yok; eseri listeden seçin`);
    const t = num(b.targetPages, 1, 2000, `"${title}" günlük hedefi`);
    const m = num(b.minPages, 0, 2000, `"${title}" alt sınırı`);
    if (m > t) throw new Error(`${label}"${title}" için alt sınır hedeften büyük olamaz`);
    return { id: typeof b.id === "string" && b.id ? b.id.slice(0, 40) : crypto.randomUUID().slice(0, 12), title, targetPages: t, minPages: m };
  });
  const targetPages = books.length ? books.reduce((s, b) => s + b.targetPages, 0) : num(r.targetPages, 1, 2000, "Günlük hedef");
  const minPages = books.length ? books.reduce((s, b) => s + b.minPages, 0) : num(r.minPages, 0, 2000, "Alt sınır");
  if (minPages > targetPages) throw new Error(`${label}Alt sınır günlük hedeften büyük olamaz`);
  return {
    penaltyMode,
    targetPages,
    minPages,
    books,
    penaltyAmount: num(r.penaltyAmount, 0, 100000, "Ceza tutarı"),
    minDiscount: penaltyMode === "FIXED" ? num(r.minDiscount ?? 0, 0, 100, "İndirim oranı") : 0,
  };
}

type TeamInput = RulesInput & { id?: string; name: string };
const rulesOf = ({ penaltyMode, targetPages, minPages, penaltyAmount, minDiscount, books }: RulesInput): RulesInput => ({ penaltyMode, targetPages, minPages, penaltyAmount, minDiscount, books });

function parseTeams(fd: FormData, keep?: Set<string>): { enabled: boolean; teams: TeamInput[] } {
  const enabled = str(fd, "teamsEnabled") === "1";
  // Ekipler kapalıyken formda kalmış ekip taslakları doğrulanmaz ve kaydedilmez
  if (!enabled) return { enabled, teams: [] };
  let raw: Record<string, unknown>[] = [];
  try {
    raw = JSON.parse(String(fd.get("teams") ?? "[]"));
  } catch {}
  const teams = raw.slice(0, 20).map((t, i) => {
    const name = String(t.name ?? "").trim().slice(0, 40);
    if (enabled && !name) throw new Error(`${i + 1}. ekibin adını yazın`);
    return { id: typeof t.id === "string" ? t.id : undefined, name, ...validateRules(t, `${name || `${i + 1}. ekip`}: `, keep) };
  });
  if (enabled && teams.length < 2) throw new Error("Ekiplere bölmek için en az 2 ekip oluşturun");
  return { enabled, teams };
}

/** Ekipleri ekler/günceller/siler (silinen ekibin üyeleri ekipsiz kalır) */
async function saveTeams(groupId: string, teams: TeamInput[]) {
  const db = getDb();
  const existing = await db.team.findMany({ where: { groupId }, select: { id: true } });
  const keep = new Set(teams.map((t) => t.id).filter(Boolean));
  const removed = existing.filter((t) => !keep.has(t.id)).map((t) => t.id);
  if (removed.length) await db.team.deleteMany({ where: { id: { in: removed } } });
  for (const [position, { id, ...t }] of teams.entries()) {
    if (id && existing.some((e) => e.id === id)) await db.team.update({ where: { id }, data: { ...t, position } });
    else await db.team.create({ data: { ...t, position, groupId } });
  }
}

/** Ekipler açıkken grup düzeyindeki kurallar formda gizlidir; ilk ekibin kuralları kullanılır. */
function parseGroupForm(fd: FormData, teamRules?: RulesInput, keep?: Set<string>) {
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
    chatPolicy: str(fd, "chatPolicy") === "ADMINS" ? ("ADMINS" as const) : ("ALL" as const),
    ...(teamRules ?? validateRules({
      penaltyMode,
      targetPages: fd.get("targetPages"),
      minPages: fd.get("minPages"),
      penaltyAmount: fd.get("penaltyAmount"),
      minDiscount: fd.get("minDiscount"),
      books: fd.get("books"),
    }, "", keep)),
    shareProgress: str(fd, "shareProgress") === "1",
    iban,
    ibanName: str(fd, "ibanName", 80),
    startMinute,
    deadlineMinute,
    reminderHours: int(fd, "reminderHours", 0, 23, "Uyarı süresi"),
    // Eski istemciler göndermezse ay sonu (0) kalır
    dueOffsetDays: fd.get("dueOffsetDays") == null || fd.get("dueOffsetDays") === "" ? undefined : int(fd, "dueOffsetDays", -25, 25, "Vade kaydırma"),
    kickOnExpire: fd.get("kickOnExpire") == null ? undefined : str(fd, "kickOnExpire") === "1",
    nameDisplay: (["ENTERED", "ACCOUNT", "BOTH"].includes(str(fd, "nameDisplay")) ? str(fd, "nameDisplay") : undefined) as "ENTERED" | "ACCOUNT" | "BOTH" | undefined,
    badgesEnabled: fd.get("badgesEnabled") == null ? undefined : str(fd, "badgesEnabled") === "1",
  };
}

// ---------- Profil ----------

/** Kullanmak istediği adı kaydeder (tek alan). Hesap adıyla aynı/çok benzerse hesap adı kullanılır. */
export async function saveFullName(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    // Eski istemciler ad ve soyadı ayrı gönderir
    const raw = fd.get("name") ?? [fd.get("firstName"), fd.get("lastName")].filter(Boolean).join(" ");
    const entered = cleanName(raw);
    const name = chooseName(entered, user.accountName);
    const parts = entered.split(" ");
    try {
      const clerk = await clerkClient();
      await clerk.users.updateUser(user.id, parts.length > 1 ? { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] } : { firstName: entered });
    } catch (e) {
      // Clerk'e yazılamasa da uygulamadaki ad güncellenir
      console.error("Clerk adı güncellenemedi", e);
    }
    await getDb().user.update({ where: { id: user.id }, data: { name, nameConfirmed: true } });
    refresh();
    return name === entered ? "Adın kaydedildi" : `Hesap adın kullanılacak: ${name}`;
  });
}

// ---------- Grup ----------

export async function createGroup(_: Prev, fd: FormData) {
  const res = await createGroupState(fd);
  if (res?.ok) redirect(`/gruplar/${res.id}`);
  return res;
}

export async function createGroupState(fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const { enabled, teams } = parseTeams(fd);
    const data = parseGroupForm(fd, enabled ? rulesOf(teams[0]) : undefined);
    const db = getDb();
    const g = await db.group.create({ data: { ...data, teamsEnabled: enabled, ownerId: user.id } });
    if (teams.length) await saveTeams(g.id, teams);
    const firstTeam = enabled ? (await db.team.findFirst({ where: { groupId: g.id }, orderBy: { position: "asc" } }))?.id : null;
    await db.groupMember.create({ data: { groupId: g.id, userId: user.id, role: "ADMIN", teamId: firstTeam ?? null } });
    // Kurucunun diğer gruplarından seçtiği eserler: aynı eser olarak bağlanır
    await saveBookLinks(user.id, g.id, parseLinks(fd.get("bookLinks")));
    refresh();
    return { id: g.id, message: "Grup oluşturuldu" };
  });
}

export async function updateGroup(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    await requireAdmin(groupId);
    // Eski gruplarda katalog dışı kayıtlı eser adları korunabilir
    const cur = await getDb().group.findUniqueOrThrow({ where: { id: groupId }, include: { teams: true } });
    const keep = new Set([cur, ...cur.teams].flatMap((r) => booksOf(r).map((b) => b.title)));
    const { enabled, teams } = parseTeams(fd, keep);
    const data = parseGroupForm(fd, enabled ? rulesOf(teams[0]) : undefined, keep);
    const db = getDb();
    // Rozetler açılınca seriler bundan sonraki günlerden sayılır; kapatılınca süren oylama ve rozetler biter
    const badgeDay = cur.lastSettledDay ?? "";
    const badgesSince = data.badgesEnabled && !cur.badgesEnabled ? badgeDay : undefined;
    if (data.badgesEnabled === false && cur.badgesEnabled) await closeAllBadges(groupId, badgeDay);
    await db.group.update({ where: { id: groupId }, data: { ...data, teamsEnabled: enabled, ...(badgesSince !== undefined ? { badgesSince } : {}) } });
    if (enabled || teams.length) await saveTeams(groupId, teams);
    // Sohbeti ve gün kartlarını açık olanlar yeni kuralları (eser adları vb.) hemen görsün
    await publish(groupId, { type: "refresh", reason: "settings" });
    refresh();
    return "Ayarlar kaydedildi";
  });
}

export async function deleteGroup(_: Prev, fd: FormData) {
  const res = await deleteGroupState(fd);
  if (res?.ok) redirect("/gruplar");
  return res;
}

export async function deleteGroupState(fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    const { user } = await requireAdmin(groupId);
    const g = await getDb().group.findUniqueOrThrow({ where: { id: groupId } });
    if (g.ownerId !== user.id) throw new Error("Grubu yalnızca kurucusu silebilir");
    if (str(fd, "confirm") !== g.name) throw new Error("Onay için grup adını aynen yazın");
    await getDb().group.delete({ where: { id: groupId } });
    refresh();
    return "Grup silindi";
  });
}

// ---------- Okuma ----------

export async function reportReading(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const choice = (str(fd, "choice") || "all") as ReportChoice;
    if (!["all", "min", "none", "pages", "kefaret"].includes(choice)) throw new Error("Geçersiz seçim");
    const groupId = str(fd, "groupId");
    const bookChoice = str(fd, "bookChoice") as "read" | "min" | "none";
    const { log, rules } = await submitReading(user.id, groupId, {
      choice,
      pages: Number(fd.get("pages")),
      bookId: str(fd, "bookId") || undefined,
      bookChoice: ["read", "min", "none"].includes(bookChoice) ? bookChoice : undefined,
      toggle: str(fd, "toggle") === "1",
      // Çevrimdışı kuyruktan gelen işlem
      ...(str(fd, "at") && str(fd, "dayKey") ? { at: new Date(str(fd, "at")), dayKey: str(fd, "dayKey") } : {}),
    });
    await publish(groupId, { type: "refresh", reason: "day" });
    refresh();
    if (!log) return "Bildirim geri alındı · beklemede. Gün sonuna kadar bildirmezsen okumadı sayılırsın.";
    if (log.kefaret > 0) return `Kefaret okuması bildirildi: ${log.pages} sayfa. Gün kapanınca indirimin bu güne düşen payı borcundan düşülür.`;
    if (log.pages >= rules.targetPages) return `Harika! ${log.pages} sayfa bildirildi`;
    return `${log.pages} sayfa bildirildi. Hedef ${rules.targetPages} sayfa — son saate kadar güncelleyebilirsin.`;
  });
}

export async function leaveGroup(_: Prev, fd: FormData) {
  const res = await leaveGroupState(fd);
  if (res?.ok) redirect("/gruplar");
  return res;
}

export async function leaveGroupState(fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const groupId = str(fd, "groupId");
    const db = getDb();
    const m = await getMembership(groupId, user.id);
    if (!m || m.status !== "ACTIVE") throw new Error("Zaten üye değilsiniz");
    await db.groupMember.update({ where: { id: m.id }, data: { status: "LEFT", leftAt: new Date() } });
    // Son yönetici ayrıldıysa kalanlardan rastgele biri yönetici olur
    if (m.role === "ADMIN") await ensureAdmin(groupId);
    await publish(groupId, { type: "refresh", reason: "members" });
    refresh();
    return "Gruptan ayrıldın";
  });
}

// ---------- Katılım & davet ----------

/** Ekipli gruplarda seçilen ekibin gruba ait olduğunu doğrular */
async function resolveTeam(groupId: string, teamId: string | null | undefined) {
  const g = await getDb().group.findUniqueOrThrow({ where: { id: groupId }, include: { teams: true } });
  if (!teamsActive(g)) return { g, teamId: null };
  if (!teamId || !g.teams.some((t) => t.id === teamId)) throw new Error("Lütfen katılmak istediğin ekibi seç");
  return { g, teamId };
}

async function addMember(groupId: string, userId: string, teamId: string | null) {
  const { g, teamId: team } = await resolveTeam(groupId, teamId);
  await getDb().groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, teamId: team },
    update: { status: "ACTIVE", role: "MEMBER", joinedAt: new Date(), leftAt: null, teamId: team },
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
    const { teamId } = await resolveTeam(groupId, str(fd, "teamId") || null);
    await db.joinRequest.create({ data: { groupId, userId: user.id, teamId, message: str(fd, "message", 300) || null } });
    // Katılmadan önce "aynı eser" denilen eşleşmeler (katılınca devreye girer)
    await saveBookLinks(user.id, groupId, parseLinks(fd.get("bookLinks")));
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
    const g = accept ? await addMember(req.groupId, req.userId, req.teamId) : await db.group.findUniqueOrThrow({ where: { id: req.groupId } });
    await db.joinRequest.update({ where: { id: req.id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
    await notifyUsers(
      [req.userId],
      accept
        ? { title: `🎉 ${g.name} grubuna kabul edildin`, body: "Okuma gününü sohbetteki gün kartından bildirebilirsin.", url: `/gruplar/${g.id}` }
        : { title: `${g.name}`, body: "Katılım isteğin reddedildi.", url: "/gruplar" },
      { inApp: true },
    );
    await publish(req.groupId, { type: "refresh", reason: "members" });
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
    if (accept) {
      const g = await addMember(inv.groupId, user.id, str(fd, "teamId") || null);
      await saveBookLinks(user.id, g.id, parseLinks(fd.get("bookLinks")));
      await db.joinRequest.updateMany({ where: { groupId: g.id, userId: user.id, status: "PENDING" }, data: { status: "ACCEPTED" } });
      await notifyUsers(await groupAdminIds(g.id), { title: `${g.name}`, body: `${user.name} davetini kabul etti.`, url: `/gruplar/${g.id}` }, { inApp: true });
    }
    await db.invitation.update({ where: { id: inv.id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
    await publish(inv.groupId, { type: "refresh", reason: "members" });
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
    if (m.role === "ADMIN") await ensureAdmin(m.groupId);
    await notifyUsers([m.userId], { title: m.group.name, body: "Yönetici seni gruptan çıkardı.", url: "/gruplar" }, { inApp: true });
    await publish(m.groupId, { type: "refresh", reason: "members" });
    refresh();
    return "Üye çıkarıldı";
  });
}

export async function toggleAdmin(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const m = await db.groupMember.findUniqueOrThrow({ where: { id: str(fd, "memberId") }, include: { group: true, user: { select: { liteApp: true } } } });
    await requireAdmin(m.groupId);
    if (m.userId === m.group.ownerId) throw new Error("Kurucunun yetkisi değiştirilemez");
    const role = m.role === "ADMIN" ? "MEMBER" : "ADMIN";
    if (role === "ADMIN" && m.user.liteApp) throw new Error("Bu üye uygulamanın Lite sürümünü kullanıyor; Lite kullananlar yönetici yapılamaz");
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
    await publish(groupId, { type: "refresh", reason: "money" });
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
    await publish(due.groupId, { type: "refresh", reason: "money" });
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
      if (!["PENDING", "SUBMITTED", "OVERDUE"].includes(due.status)) throw new Error("Bu ödeme onaylanamaz");
      await db.paymentDue.update({ where: { id: due.id }, data: { status: "CONFIRMED", resolvedAt: new Date(), decisionUntil: null } });
      await db.penalty.updateMany({ where: { dueId: due.id }, data: { status: "PAID" } });
      await notifyUsers([due.userId], { title: `✅ ${due.group.name}`, body: `${due.amount} TL ödemen onaylandı. Teşekkürler!`, url: `/gruplar/${due.groupId}` }, { inApp: true });
      await publish(due.groupId, { type: "refresh", reason: "money" });
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
      await publish(due.groupId, { type: "refresh", reason: "money" });
      refresh();
      return "Ödeme bildirimi reddedildi";
    }
    if (decision === "cancel") {
      if (!["PENDING", "SUBMITTED", "OVERDUE"].includes(due.status)) throw new Error("Bu vade iptal edilemez");
      await db.paymentDue.update({ where: { id: due.id }, data: { status: "CANCELLED", resolvedAt: new Date(), decisionUntil: null } });
      await db.penalty.updateMany({ where: { dueId: due.id }, data: { status: "UNPAID", dueId: null } });
      await notifyUsers([due.userId], { title: due.group.name, body: "Ceza ödeme vaden iptal edildi.", url: `/gruplar/${due.groupId}` }, { inApp: true });
      await publish(due.groupId, { type: "refresh", reason: "money" });
      refresh();
      return "Vade iptal edildi";
    }
    throw new Error("Geçersiz işlem");
  });
}

/** Vadeye ek süre: "days" (gün sayısı) ya da "dueAt" (yerel tarih-saat) */
export async function extendDueAction(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const due = await db.paymentDue.findUniqueOrThrow({ where: { id: str(fd, "dueId") }, include: { group: true } });
    await requireAdmin(due.groupId);
    const days = Number(fd.get("days"));
    const base = Math.max(Date.now(), due.dueAt.getTime());
    const at = Number.isInteger(days) && days > 0 && days <= 60 ? new Date(base + days * DAY) : parseLocalDateTime(str(fd, "dueAt"), due.group.tzOffset);
    await extendDue(due.id, at);
    refresh();
    return `Ek süre verildi: ${formatDateTime(at, due.group.tzOffset)}`;
  });
}

/** Ceza indirimi: tek ceza (penaltyId), bir üye (userId) ya da tüm grup; % ya da TL */
export async function discountAction(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    await requireAdmin(groupId);
    const mode = str(fd, "mode") === "amount" ? ("amount" as const) : ("percent" as const);
    const value = mode === "percent" ? int(fd, "value", 1, 100, "İndirim oranı") : int(fd, "value", 1, 1_000_000, "İndirim tutarı");
    const res = await discountPenalties({ groupId, mode, value, userId: str(fd, "userId") || undefined, penaltyId: str(fd, "penaltyId") || undefined });
    refresh();
    return `${res.saved} TL indirim yapıldı (${res.users} kişi)`;
  });
}

/** Kefaret okuması başlat: indirim cezalardan okuma karşılığı kazanılır (bir üye ya da tüm grup) */
export async function startKefaretAction(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    const { user } = await requireAdmin(groupId);
    const discount = int(fd, "discount", 1, 100, "İndirim oranı");
    const raise = int(fd, "raise", 5, 300, "Zam oranı");
    const n = await startKefaret(groupId, user.id, discount, raise, str(fd, "userId") || undefined);
    await publish(groupId, { type: "refresh", reason: "money" });
    refresh();
    return `${n} kişi için kefaret okuması başlatıldı`;
  });
}

export async function cancelKefaretAction(_: Prev, fd: FormData) {
  return run(async () => {
    const plan = await getDb().kefaretPlan.findUniqueOrThrow({ where: { id: str(fd, "planId") } });
    await requireAdmin(plan.groupId);
    await cancelKefaret(plan.id);
    await publish(plan.groupId, { type: "refresh", reason: "money" });
    refresh();
    return `Kefaret okuması durduruldu (kazanılan ${plan.earned} TL indirim geçerli)`;
  });
}

/** Vadesi dolan üyeyi karar süresini beklemeden gruptan çıkar */
export async function kickOverdueAction(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const due = await db.paymentDue.findUniqueOrThrow({ where: { id: str(fd, "dueId") }, include: { group: true, user: true } });
    await requireAdmin(due.groupId);
    if (due.status !== "OVERDUE") throw new Error("Bu ödemenin vadesi dolmamış");
    await kickForDue(due, due.group, due.user.name);
    refresh();
    return `${due.user.name} gruptan çıkarıldı`;
  });
}

export async function waivePenalty(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const p = await db.penalty.findUniqueOrThrow({ where: { id: str(fd, "penaltyId") } });
    await requireAdmin(p.groupId);
    if (p.status !== "UNPAID") throw new Error("Yalnızca vadesi oluşturulmamış cezalar affedilebilir");
    await db.penalty.update({ where: { id: p.id }, data: { status: "WAIVED" } });
    await publish(p.groupId, { type: "refresh", reason: "money" });
    refresh();
    return "Ceza affedildi";
  });
}

/** Bildirimler sayfası açılınca: sayfayı yeniden çizmeden okundu işaretler */
export async function markNotificationsSeen() {
  const user = await actionUser();
  await getDb().notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
}

export async function markAllRead(_: Prev, _fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    await getDb().notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    refresh();
  });
}

// ---------- Sohbet ----------

async function chatMember(groupId: string, needPost = true) {
  const user = await actionUser();
  const m = await getDb().groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } }, include: { group: true } });
  if (!m || m.status !== "ACTIVE") throw new Error("Bu grubun üyesi değilsiniz");
  if (needPost && !canPost(m.group, m.role)) throw new Error("Bu grupta yalnızca yöneticiler mesaj gönderebilir");
  return { user, member: m };
}

export async function sendMessage(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    const text = str(fd, "text", 2000);
    if (!text) throw new Error("Mesaj boş olamaz");
    const { user, member } = await chatMember(groupId);
    // Taşkın koruması: dakikada en fazla 20 mesaj
    const recent = await getDb().message.count({ where: { groupId, userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
    if (recent >= 20) throw new Error("Çok hızlı mesaj gönderiyorsun, biraz bekle");
    const m = await getDb().message.create({ data: { groupId, userId: user.id, kind: "TEXT", text } });
    await publish(groupId, {
      type: "message",
      message: {
        id: m.id,
        kind: "TEXT",
        text,
        createdAt: m.createdAt.toISOString(),
        user: { id: user.id, name: shownName(user, member.group.nameDisplay), imageUrl: user.imageUrl, initial: avatarInitial(user), badge: (await activeBadges(member.group)).get(user.id) ?? null },
        day: null,
        poll: null,
        badge: null,
      },
    });
    notifyChat(member.group, user.id, `💬 ${member.group.name}`, `${shownName(user, member.group.nameDisplay)}: ${text}`);
    return { id: m.id };
  });
}

export async function createPoll(_: Prev, fd: FormData) {
  return run(async () => {
    const groupId = str(fd, "groupId");
    const question = str(fd, "question", 300);
    let options: string[] = [];
    try {
      options = (JSON.parse(String(fd.get("options") ?? "[]")) as unknown[]).map((o) => String(o).trim().slice(0, 100)).filter(Boolean);
    } catch {}
    options = [...new Set(options)];
    if (question.length < 2) throw new Error("Anket sorusunu yazın");
    if (options.length < 2 || options.length > 10) throw new Error("2 ile 10 arasında seçenek girin");
    const { user, member } = await chatMember(groupId);
    const db = getDb();
    const polls = await db.message.count({ where: { groupId, userId: user.id, kind: "POLL", createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (polls >= 5) throw new Error("Kısa sürede çok fazla anket açtın, biraz bekle");
    const m = await db.message.create({ data: { groupId, userId: user.id, kind: "POLL" } });
    const poll = await db.poll.create({ data: { messageId: m.id, question, multiple: str(fd, "multiple") === "1" } });
    await db.pollOption.createMany({ data: options.map((text, position) => ({ pollId: poll.id, text, position })) });
    await publish(groupId, { type: "refresh", reason: "poll" });
    notifyChat(member.group, user.id, `📊 ${member.group.name}`, `${shownName(user, member.group.nameDisplay)} anket açtı: ${question}`);
    return { id: m.id, message: "Anket gönderildi" };
  });
}

export async function votePoll(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const option = await db.pollOption.findUniqueOrThrow({ where: { id: str(fd, "optionId") }, include: { poll: { include: { message: true } } } });
    const { user } = await chatMember(option.poll.message.groupId, false);
    const existing = await db.pollVote.findUnique({ where: { optionId_userId: { optionId: option.id, userId: user.id } } });
    if (existing) {
      await db.pollVote.delete({ where: { id: existing.id } }); // oyu geri al
    } else {
      if (!option.poll.multiple) await db.pollVote.deleteMany({ where: { pollId: option.pollId, userId: user.id } });
      await db.pollVote.create({ data: { pollId: option.pollId, optionId: option.id, userId: user.id } });
    }
    await publish(option.poll.message.groupId, { type: "refresh", reason: "poll" });
  });
}

export async function deleteMessage(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const msg = await db.message.findUniqueOrThrow({ where: { id: str(fd, "messageId") } });
    if (msg.kind === "DAY") throw new Error("Gün kartları silinemez");
    if (msg.kind === "BADGE") throw new Error("Rozet kartları silinemez; rozeti karttaki düğmeyle kaldırabilirsiniz");
    const { user, member } = await chatMember(msg.groupId, false);
    if (msg.userId !== user.id && member.role !== "ADMIN") throw new Error("Bu mesajı silemezsiniz");
    await db.message.delete({ where: { id: msg.id } });
    await publish(msg.groupId, { type: "refresh", reason: "delete" });
    return "Mesaj silindi";
  });
}

/** Gruba yazılan mesaj diğer üyelere bildirim olarak gider (yanıttan sonra, arka planda) */
function notifyChat(group: { id: string; name: string }, authorId: string, title: string, body: string) {
  after(async () => {
    const others = await getDb().groupMember.findMany({ where: { groupId: group.id, status: "ACTIVE", userId: { not: authorId } }, select: { userId: true } });
    await notifyUsers(
      others.map((o) => o.userId),
      { title, body: body.length > 140 ? `${body.slice(0, 137)}…` : body, url: `/gruplar/${group.id}`, tag: `msg-${group.id}`, renotify: true },
    ).catch((e) => console.error("mesaj bildirimi", e));
  });
}

// ---------- Rozetler ----------

/** Oylamadaki rozet: üye olmalı, rozetin sahibi olmamalı, oylama sürmeli */
async function votingBadge(badgeId: string) {
  const db = getDb();
  const badge = await db.badge.findUniqueOrThrow({ where: { id: badgeId }, include: { group: { select: { badgesEnabled: true } } } });
  const { user, member } = await chatMember(badge.groupId, false);
  if (!badge.group.badgesEnabled) throw new Error("Bu grupta rozetler kapalı");
  if (badge.status !== "VOTING" || !badge.voteUntil || badge.voteUntil <= new Date()) throw new Error("Bu rozetin oylaması bitti");
  if (badge.userId === user.id) throw new Error("Kendi rozetine öneri yapamaz ve oy veremezsin");
  return { db, badge, user, member };
}

export async function proposeBadge(_: Prev, fd: FormData) {
  return run(async () => {
    const { db, badge, user } = await votingBadge(str(fd, "badgeId"));
    const label = cleanBadgeLabel(str(fd, "label", 60));
    const options = await db.badgeOption.findMany({ where: { badgeId: badge.id }, select: { label: true, authorId: true } });
    if (options.some((o) => o.authorId === user.id)) throw new Error("Bu rozet için zaten bir şık önerdin");
    if (options.length >= 12) throw new Error("Bu oylamada en fazla 12 şık olabilir");
    const fold = (v: string) => v.toLocaleLowerCase("tr-TR");
    if (options.some((o) => fold(o.label) === fold(label))) throw new Error("Bu şık zaten önerildi, ona oy verebilirsin");
    const option = await db.badgeOption.create({ data: { badgeId: badge.id, label, authorId: user.id } });
    // Öneren kendi şıkkına oy vermiş sayılır (sonra değiştirebilir)
    await db.badgeVote.upsert({ where: { badgeId_userId: { badgeId: badge.id, userId: user.id } }, create: { badgeId: badge.id, optionId: option.id, userId: user.id }, update: { optionId: option.id } });
    await publish(badge.groupId, { type: "refresh", reason: "badge" });
    return "Şık eklendi";
  });
}

export async function voteBadge(_: Prev, fd: FormData) {
  return run(async () => {
    const { db, badge, user } = await votingBadge(str(fd, "badgeId"));
    const option = await db.badgeOption.findFirst({ where: { id: str(fd, "optionId"), badgeId: badge.id } });
    if (!option) throw new Error("Şık bulunamadı");
    await db.badgeVote.upsert({ where: { badgeId_userId: { badgeId: badge.id, userId: user.id } }, create: { badgeId: badge.id, optionId: option.id, userId: user.id }, update: { optionId: option.id } });
    await publish(badge.groupId, { type: "refresh", reason: "badge" });
  });
}

/** Uygunsuz şıkkı yönetici ya da öneren kaldırabilir */
export async function deleteBadgeOption(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const option = await db.badgeOption.findUniqueOrThrow({ where: { id: str(fd, "optionId") }, include: { badge: true } });
    const { user, member } = await chatMember(option.badge.groupId, false);
    if (option.authorId !== user.id && member.role !== "ADMIN") throw new Error("Bu şıkkı yalnızca öneren ya da yönetici kaldırabilir");
    if (option.badge.status !== "VOTING") throw new Error("Oylama bitti");
    await db.badgeOption.delete({ where: { id: option.id } });
    await publish(option.badge.groupId, { type: "refresh", reason: "badge" });
    return "Şık kaldırıldı";
  });
}

/** Yönetici rozeti (ya da süren oylamayı) kaldırır */
export async function removeBadge(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const badge = await db.badge.findUniqueOrThrow({ where: { id: str(fd, "badgeId") }, include: { group: { select: { lastSettledDay: true } } } });
    await requireAdmin(badge.groupId);
    if (badge.status !== "VOTING" && badge.status !== "ACTIVE") throw new Error("Bu rozet zaten kalkmış");
    await db.badge.update({ where: { id: badge.id }, data: { status: badge.status === "VOTING" ? "CANCELLED" : "ENDED", endedDay: badge.group.lastSettledDay ?? badge.streakDay, endedAt: new Date() } });
    if (badge.status === "ACTIVE") await db.message.create({ data: { groupId: badge.groupId, kind: "BADGE", text: "END", badgeId: badge.id } });
    await publish(badge.groupId, { type: "refresh", reason: "badge" });
    return badge.status === "VOTING" ? "Oylama iptal edildi" : "Rozet kaldırıldı";
  });
}

// ---------- Ekipler ----------

/** Üye ekip seçer; zaten bir ekibi varsa değişiklik yönetici onayına gider. */
export async function requestTeamChange(_: Prev, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const groupId = str(fd, "groupId");
    const db = getDb();
    const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } }, include: { group: { include: { teams: true } } } });
    if (!m || m.status !== "ACTIVE") throw new Error("Bu grubun üyesi değilsiniz");
    const { teamId } = await resolveTeam(groupId, str(fd, "teamId"));
    if (!teamId || teamId === m.teamId) throw new Error("Zaten bu ekiptesin");
    const team = m.group.teams.find((t) => t.id === teamId)!;
    if (!m.teamId || m.role === "ADMIN") {
      await db.groupMember.update({ where: { id: m.id }, data: { teamId } });
      refresh();
      return `${team.name} ekibine geçtin`;
    }
    await db.teamChangeRequest.updateMany({ where: { groupId, userId: user.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await db.teamChangeRequest.create({ data: { groupId, userId: user.id, teamId } });
    await notifyUsers(
      await groupAdminIds(groupId),
      { title: `${m.group.name}: ekip değişikliği isteği`, body: `${user.name} ${team.name} ekibine geçmek istiyor.`, url: `/gruplar/${groupId}/yonetim?tab=davet` },
      { inApp: true },
    );
    refresh();
    return "İsteğin yöneticiye gönderildi";
  });
}

export async function respondTeamChange(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const req = await db.teamChangeRequest.findUniqueOrThrow({ where: { id: str(fd, "requestId") }, include: { team: true, group: true } });
    await requireAdmin(req.groupId);
    if (req.status !== "PENDING") throw new Error("İstek zaten yanıtlanmış");
    const accept = str(fd, "accept") === "1";
    await db.teamChangeRequest.update({ where: { id: req.id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
    if (accept) await db.groupMember.updateMany({ where: { groupId: req.groupId, userId: req.userId, status: "ACTIVE" }, data: { teamId: req.teamId } });
    await notifyUsers(
      [req.userId],
      { title: req.group.name, body: accept ? `${req.team.name} ekibine geçişin onaylandı.` : `${req.team.name} ekibine geçiş isteğin reddedildi.`, url: `/gruplar/${req.groupId}/bilgi` },
      { inApp: true },
    );
    await publish(req.groupId, { type: "refresh", reason: "members" });
    refresh();
    return accept ? "Ekip değişikliği onaylandı" : "İstek reddedildi";
  });
}

/** Yönetici üyeyi doğrudan bir ekibe atar */
export async function setMemberTeam(_: Prev, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const m = await db.groupMember.findUniqueOrThrow({ where: { id: str(fd, "memberId") } });
    await requireAdmin(m.groupId);
    const { teamId } = await resolveTeam(m.groupId, str(fd, "teamId"));
    await db.groupMember.update({ where: { id: m.id }, data: { teamId } });
    await db.teamChangeRequest.updateMany({ where: { groupId: m.groupId, userId: m.userId, status: "PENDING" }, data: { status: "CANCELLED" } });
    await publish(m.groupId, { type: "refresh", reason: "members" });
    refresh();
    return "Ekip güncellendi";
  });
}
