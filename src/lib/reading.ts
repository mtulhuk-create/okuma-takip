import { propagateLinkedBooks } from "./book-links";
import { getDb } from "./db";
import { parseBookLogs, rulesFor, type BookLog } from "./rules";
import { openPeriod } from "./schedule";

/** all/min/none: tüm eserler için · pages: toplam sayfa (eserlere sırayla dağıtılır) · book: tek eser */
export type ReportChoice = "all" | "min" | "none" | "pages";
/** toggle: aynı seçim tekrar gönderilirse bildirimi geri al (beklemeye dön) */
export type ReportInput = { choice: ReportChoice; pages?: number; bookId?: string; bookChoice?: "read" | "min" | "none"; toggle?: boolean };

/** Üyenin bugünkü (açık) okuma gününe bildirim yapması. */
export async function submitReading(userId: string, groupId: string, input: ReportInput, expectedDayKey?: string) {
  const db = getDb();
  const member = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: { include: { teams: true } } },
  });
  if (!member || member.status !== "ACTIVE") throw new Error("Bu grubun aktif üyesi değilsiniz");
  const period = openPeriod(new Date(), member.group);
  if (!period) throw new Error("Bugünün bildirim süresi doldu. Yeni okuma günü başlayınca bildirebilirsiniz.");
  if (expectedDayKey && expectedDayKey !== period.dayKey) throw new Error("Bu bildirimin süresi geçmiş");
  const rules = rulesFor(member.group, member);

  const existing = await db.readingLog.findUnique({ where: { groupId_userId_dayKey: { groupId, userId, dayKey: period.dayKey } } });
  const prev = new Map(parseBookLogs(existing?.books).map((b) => [b.id, b.pages]));
  let books: BookLog[] = rules.books.map((b) => ({ id: b.id, title: b.title, target: b.targetPages, min: b.minPages, pages: prev.get(b.id) ?? null }));

  const before = books.map((b) => b.pages);
  if (input.bookId) {
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
  const unchanged = !input.bookId && books.every((b, i) => b.pages === before[i]);
  if ((input.toggle && unchanged && existing) || (existing && books.every((b) => b.pages == null))) {
    await db.readingLog.delete({ where: { id: existing.id } });
    return { log: null, period, member, rules, undone: true as const };
  }

  const snapshot = {
    pages: books.reduce((s, b) => s + (b.pages ?? 0), 0),
    requiredPages: rules.targetPages,
    minPages: rules.minPages,
    books,
  };
  const log = await db.readingLog.upsert({
    where: { groupId_userId_dayKey: { groupId, userId, dayKey: period.dayKey } },
    create: { groupId, userId, dayKey: period.dayKey, ...snapshot },
    update: snapshot,
  });
  // Diğer gruplarda "aynı eser" olarak bağlanan kitaplar da işaretlenir (orada hedef kadar)
  await propagateLinkedBooks(userId, groupId, books).catch(() => {});
  return { log, period, member, rules, undone: false as const };
}
