import { getDb } from "./db";
import { openPeriod } from "./schedule";

export type ReportChoice = "min" | "none" | "pages";

/** Üyenin bugünkü (açık) okuma gününe sayfa bildirmesi. */
export async function submitReading(userId: string, groupId: string, choice: ReportChoice, pagesInput?: number, expectedDayKey?: string) {
  const db = getDb();
  const member = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });
  if (!member || member.status !== "ACTIVE") throw new Error("Bu grubun aktif üyesi değilsiniz");
  const period = openPeriod(new Date(), member.group);
  if (!period) throw new Error("Bugünün bildirim süresi doldu. Yeni okuma günü başlayınca bildirebilirsiniz.");
  if (expectedDayKey && expectedDayKey !== period.dayKey) throw new Error("Bu bildirimin süresi geçmiş");

  let pages: number;
  if (choice === "min") pages = member.dailyPages;
  else if (choice === "none") pages = 0;
  else {
    pages = Math.floor(Number(pagesInput));
    if (!Number.isFinite(pages) || pages < 0 || pages > 5000) throw new Error("Geçerli bir sayfa sayısı girin");
  }

  const log = await db.readingLog.upsert({
    where: { groupId_userId_dayKey: { groupId, userId, dayKey: period.dayKey } },
    create: { groupId, userId, dayKey: period.dayKey, pages, requiredPages: member.dailyPages },
    update: { pages, requiredPages: member.dailyPages },
  });
  return { log, period, member };
}
