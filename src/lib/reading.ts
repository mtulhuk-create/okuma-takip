import type { Group, Team } from "@prisma/client";
import { after } from "next/server";
import { propagateLinkedBooks } from "./book-links";
import { getDb } from "./db";
import { fcmEnabled, pushData } from "./fcm";
import { shownName } from "./names";
import { notifyUsers } from "./notify";
import { parseBookLogs, penaltyFor, rulesFor, type BookLog } from "./rules";
import { openPeriod, periodFor } from "./schedule";

/** all/min/none: tüm eserler için · pages: toplam sayfa (eserlere sırayla dağıtılır) · book: tek eser */
export type ReportChoice = "all" | "min" | "none" | "pages" | "kefaret";
/** toggle: aynı seçim tekrar gönderilirse bildirimi geri al (beklemeye dön) */
export type ReportInput = {
  choice: ReportChoice;
  pages?: number;
  bookId?: string;
  bookChoice?: "read" | "min" | "none";
  toggle?: boolean;
  /** Çevrimdışı yapılan işlem: işlemin yapıldığı an ve gün (internet gelince gönderilir) */
  at?: Date;
  dayKey?: string;
};

/**
 * Bir işaretlemenin kısa anlatımı (bildirimlerde): okudu / alt sınırı okudu / okumadı + sayfa.
 * Grupta gün kartı ayrıntısı kapalıysa yalnızca "bildirimini yaptı" denir.
 */
export function markLabel(log: { pages: number; requiredPages: number; minPages: number; kefaret: number }, details: boolean) {
  if (!details) return "📖 Bildirimini yaptı";
  if (log.kefaret > 0) return `📗 Kefaret okuması yaptı · ${log.pages} sf`;
  if (log.pages >= log.requiredPages && log.pages > 0) return `✅ Okudu · ${log.pages} sf`;
  if (log.pages === 0) return "❌ Okumadı";
  return log.pages >= log.minPages ? `☑️ Alt sınırı okudu · ${log.pages} sf` : `📖 ${log.pages} sf okudu`;
}

type MarkLog = Parameters<typeof markLabel>[0] & { id: string; updatedAt: Date; books: unknown };

/**
 * İşaretleme yapılınca (ya da geri alınınca), yanıttan sonra arka planda:
 * - diğer okuyuculara bildirim: "Ad: Okudu · 50 sf" (tarayıcı + telefondaki uygulama)
 * - herkesin telefonundaki sabit gün kartı anında güncellenir (kaç kişi okudu çubuğu)
 * - işaretleyenin diğer cihazlarında o günün hatırlatmaları iptal edilir, kartı güncellenir
 * log null: bildirim geri alındı (yalnızca kartlar güncellenir).
 */
function notifyMark(group: Group & { teams: Team[] }, userId: string, dayKey: string, log: MarkLog | null) {
  const run = async () => {
    const db = getDb();
    const [user, members] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { name: true, accountName: true } }),
      db.groupMember.findMany({ where: { groupId: group.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true, accountName: true, imageUrl: true } } } }),
    ]);
    if (!user) return;
    const others = members.filter((m) => m.userId !== userId).map((m) => m.userId);
    const name = shownName(user, group.nameDisplay);
    const jobs: Promise<unknown>[] = [];
    if (log && others.length) {
      const label = markLabel(log, group.dayDetails);
      // Aynı kişinin art arda işaretlemeleri tek bildirimde güncellenir
      jobs.push(notifyUsers(others, { title: `📖 ${group.name}`, body: `${name}: ${label}`, url: `/gruplar/${group.id}`, tag: `mark-${group.id}-${userId}`, renotify: true }, { push: true }));
      // Kimlik, mesaj akışındaki (aralıklı kontrol) kimlikle aynı: telefonda iki kez gösterilmez
      jobs.push(pushData(others, { type: "msg", id: `mark-${log.id}-${log.updatedAt.getTime()}`, groupId: group.id, groupName: group.name, author: name, text: label, createdAt: log.updatedAt.toISOString() }));
    }
    if (fcmEnabled()) {
      // Sabit gün kartı: gruptaki herkesin kartındaki çubuk ve sayılar
      const { getDayCards } = await import("./day");
      const card = (await getDayCards(group, members.map((m) => ({ ...m, user: { ...m.user, name: shownName(m.user, group.nameDisplay) } })), [dayKey], userId))[dayKey];
      if (card) {
        const kef = card.read.filter((p) => p.kefaret).length;
        const seg = { kef, read: card.read.length - kef, min: card.min.length, none: card.none.length, pending: card.pending.length };
        jobs.push(
          pushData(members.map((m) => m.userId), { type: "card", groupId: group.id, dayKey, seg: JSON.stringify(seg), done: String(card.read.length + card.min.length), total: String(seg.kef + seg.read + seg.min + seg.none + seg.pending), kefCount: String(kef) }),
        );
      }
      // İşaretleyenin kendi cihazları: hatırlatmalar iptal, kartındaki seçili butonlar güncel
      const books = parseBookLogs(log?.books).map((b) => ({ id: b.id, pages: b.pages }));
      jobs.push(pushData([userId], { type: "reported", groupId: group.id, dayKey, reported: log ? "1" : "0", books: JSON.stringify(books), kefaretOn: log && log.kefaret > 0 ? "1" : "0" }));
    }
    await Promise.allSettled(jobs);
  };
  try {
    after(() => run().catch((e) => console.error("işaretleme bildirimi", e)));
  } catch {
    // İstek dışında çağrıldıysa (test, cron) bildirim atlanır
  }
}

/** Çevrimdışı işlemler gün kapandıktan en fazla bu kadar sonra kabul edilir */
export const OFFLINE_GRACE_MS = 72 * 3_600_000;

/** Üyenin bugünkü (açık) okuma gününe bildirim yapması. */
export async function submitReading(userId: string, groupId: string, input: ReportInput, expectedDayKey?: string) {
  const db = getDb();
  const member = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: { include: { teams: true } } },
  });
  if (!member || member.status !== "ACTIVE") throw new Error("Bu grubun aktif üyesi değilsiniz");
  const now = new Date();
  let period = openPeriod(now, member.group);
  let late = false;
  // İnternetsizken yapılan işlem: işlemin yapıldığı an o günün süresi içindeyse, gün kapanmış olsa da kabul edilir
  if (input.at && input.dayKey && (!period || period.dayKey !== input.dayKey)) {
    const p = periodFor(input.dayKey, member.group);
    const at = input.at.getTime();
    if (at >= p.start.getTime() && at < p.deadline.getTime() && at <= now.getTime() + 5 * 60_000 && now.getTime() - p.deadline.getTime() <= OFFLINE_GRACE_MS) {
      period = p;
      late = now >= p.deadline;
    } else throw new Error("Bu işlem okuma günü bittikten sonra yapılmış; kaydedilemedi");
  }
  if (!period) throw new Error("Bugünün bildirim süresi doldu. Yeni okuma günü başlayınca bildirebilirsiniz.");
  if (expectedDayKey && expectedDayKey !== period.dayKey) throw new Error("Bu bildirimin süresi geçmiş");
  const rules = rulesFor(member.group, member);

  const existing = await db.readingLog.findUnique({ where: { groupId_userId_dayKey: { groupId, userId, dayKey: period.dayKey } } });
  const prev = new Map(parseBookLogs(existing?.books).map((b) => [b.id, b.pages]));
  let books: BookLog[] = rules.books.map((b) => ({ id: b.id, title: b.title, target: b.targetPages, min: b.minPages, pages: prev.get(b.id) ?? null }));

  const before = books.map((b) => b.pages);
  // Kefaret okuması: tüm eserler hedefinde + plandaki ek sayfa (eserlere hedefleri oranında dağıtılır)
  let kefaret = { extra: 0, planId: null as string | null };
  if (input.choice === "kefaret" && !input.bookId) {
    const plan = await db.kefaretPlan.findFirst({ where: { groupId, userId, status: "ACTIVE", startDay: { lte: period.dayKey } }, orderBy: { createdAt: "desc" } });
    if (!plan) throw new Error("Süren bir kefaret okuman yok");
    // Aynı butona tekrar basıldı: kefaret bildirimi geri alınır
    if (input.toggle && existing?.kefaretPlanId === plan.id) {
      await db.readingLog.delete({ where: { id: existing.id } });
      if (late) await fixSettledPenalty(member.group, member, period.dayKey, 0, rules);
      return { log: null, period, member, rules, undone: true as const };
    }
    kefaret = { extra: plan.dailyExtra, planId: plan.id };
    const total = books.reduce((s, b) => s + b.target, 0) || 1;
    let left = plan.dailyExtra;
    books = books.map((b, i) => {
      const share = i === books.length - 1 ? left : Math.min(left, Math.floor((plan.dailyExtra * b.target) / total));
      left -= share;
      return { ...b, pages: b.target + share };
    });
  } else if (input.bookId) {
    const book = books.find((b) => b.id === input.bookId);
    if (!book) throw new Error("Eser bulunamadı");
    const next = input.bookChoice === "read" ? book.target : input.bookChoice === "min" ? book.min : 0;
    // Aynı butona tekrar basıldı: bu eserin bildirimi geri alınır
    book.pages = input.toggle && book.pages === next ? null : next;
  } else if (input.choice === "all") books = books.map((b) => ({ ...b, pages: b.target }));
  else if (input.choice === "min") books = books.map((b) => ({ ...b, pages: b.min }));
  else if (input.choice === "none") books = books.map((b) => ({ ...b, pages: 0 }));
  else {
    let left = Math.floor(Number(input.pages));
    if (!Number.isFinite(left) || left < 0 || left > 5000) throw new Error("Geçerli bir sayfa sayısı girin");
    books = books.map((b, i) => {
      const p = i === books.length - 1 ? left : Math.min(left, b.target);
      left -= p;
      return { ...b, pages: p };
    });
  }

  // Tümü için aynı seçim tekrar gönderildiyse (ya da hiçbir eser bildirimi kalmadıysa) bugünkü bildirim silinir: beklemede
  const unchanged = !input.bookId && !kefaret.planId && !existing?.kefaretPlanId && books.every((b, i) => b.pages === before[i]);
  if ((input.toggle && unchanged && existing) || (existing && books.every((b) => b.pages == null))) {
    await db.readingLog.delete({ where: { id: existing.id } });
    if (late) await fixSettledPenalty(member.group, member, period.dayKey, 0, rules);
    else notifyMark(member.group, userId, period.dayKey, null);
    return { log: null, period, member, rules, undone: true as const };
  }

  const snapshot = {
    pages: books.reduce((s, b) => s + (b.pages ?? 0), 0),
    requiredPages: rules.targetPages,
    minPages: rules.minPages,
    books,
    kefaret: kefaret.extra,
    kefaretPlanId: kefaret.planId,
  };
  const log = await db.readingLog.upsert({
    where: { groupId_userId_dayKey: { groupId, userId, dayKey: period.dayKey } },
    create: { groupId, userId, dayKey: period.dayKey, ...snapshot },
    update: snapshot,
  });
  // Gün kapandıktan sonra gelen çevrimdışı işlem: yazılmış cezayı yeni bildirime göre düzelt
  if (late) await fixSettledPenalty(member.group, member, period.dayKey, log.pages, { ...rules, targetPages: log.requiredPages, minPages: log.minPages });
  // Diğer gruplarda "aynı eser" olarak bağlanan kitaplar da işaretlenir (orada hedef kadar)
  else await propagateLinkedBooks(userId, groupId, books).catch(() => {});
  // Gün kapandıktan sonra gelen (çevrimdışı) işlemler bildirilmez
  if (!late) notifyMark(member.group, userId, period.dayKey, log);
  return { log, period, member, rules, undone: false as const };
}

/**
 * Gün kapandıktan sonra (çevrimdışı) gelen bildirimle, o gün için yazılmış ödenmemiş cezayı düzeltir:
 * ceza gerekmiyorsa kaldırılır, tutar değiştiyse güncellenir. Vadeye bağlanmış ya da ödenmiş cezaya dokunulmaz.
 */
async function fixSettledPenalty(
  group: { id: string; lastSettledDay: string | null },
  member: { userId: string; joinedAt: Date },
  dayKey: string,
  pages: number,
  rules: Parameters<typeof penaltyFor>[0],
) {
  const db = getDb();
  const pen = await db.penalty.findUnique({ where: { groupId_userId_dayKey: { groupId: group.id, userId: member.userId, dayKey } } });
  if (!pen || pen.status !== "UNPAID") return;
  const amount = penaltyFor(rules, pages);
  if (amount <= 0) await db.penalty.delete({ where: { id: pen.id } });
  else if (amount !== pen.amount) await db.penalty.update({ where: { id: pen.id }, data: { amount, pagesRead: pages } });
}
