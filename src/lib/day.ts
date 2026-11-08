import "server-only";
import type { Group, Team } from "@prisma/client";
import { linkedGroupNames } from "./book-links";
import { getDb } from "./db";
import { categoryOf, parseBookLogs, penaltyFor, rulesFor, type BookLog } from "./rules";
import { periodFor } from "./schedule";

export type DayPerson = { id: string; name: string; imageUrl: string | null; initial?: string; pages: number | null; required: number; kefaret?: number };
/** Kişinin süren kefaret okuması (gün kartında "Kefaret" butonu) */
export type DayKefaret = {
  planId: string;
  dailyExtra: number;
  days: number;
  doneDays: number;
  discountTotal: number;
  earned: number;
  startDay: string;
  discountPercent: number;
  /** Kefaret okuması bildirilen günler (bugün dahil) */
  usedDays: string[];
};
export type DayCard = {
  dayKey: string;
  start: string;
  deadline: string;
  open: boolean;
  /** okudu: hedef ve üstü · min: alt sınır–hedef arası · none: alt sınır altı / bildirmedi · pending: henüz bildirmedi (gün açık) */
  read: DayPerson[];
  min: DayPerson[];
  none: DayPerson[];
  pending: DayPerson[];
  me: {
    eligible: boolean;
    pages: number | null;
    target: number;
    min: number;
    teamName: string | null;
    books: (BookLog & { linked?: string[] })[];
    /** Bu gün kefaret okuması bildirildi mi (ek sayfa) */
    kefaret: number;
    /** Süren kefaret planı (gün açık ve plan bu günü kapsıyorsa) */
    plan: DayKefaret | null;
    /** Butonlarda gösterilen ceza: alt sınırı okursa / okumazsa (TL) */
    fine: { min: number; none: number };
  } | null;
  /** Günün hasılatı (TL): kasanın o gün alacağı ceza. Gün kapandıysa yazılan cezalar; açıksa bildirmeyenler okumadı sayılarak */
  penaltyTotal: number;
  /** Kesinleşmiş mi (gün kapandı ve cezalar yazıldı) */
  penaltyFinal: boolean;
};

type Member = { userId: string; teamId: string | null; joinedAt: Date; user: { id: string; name: string; imageUrl: string | null; initial?: string } };

/** Belirtilen günler için grubun okuma durumunu kategorilere ayırır (tek sorgu). */
export async function getDayCards(group: Group & { teams: Team[] }, members: Member[], dayKeys: string[], meId: string) {
  const [logs, penalties] = dayKeys.length
    ? await Promise.all([
        getDb().readingLog.findMany({ where: { groupId: group.id, dayKey: { in: dayKeys } } }),
        getDb().penalty.groupBy({ by: ["dayKey"], where: { groupId: group.id, dayKey: { in: dayKeys }, status: { not: "WAIVED" } }, _sum: { amount: true } }),
      ])
    : [[], []];
  const written = new Map(penalties.map((p) => [p.dayKey, p._sum.amount ?? 0]));
  // Kullanıcının bu gruptaki eserleri başka gruplarla "aynı eser" olarak bağlı mı
  const linked = dayKeys.length && members.some((m) => m.userId === meId) ? await linkedGroupNames(meId, group.id) : new Map<string, string[]>();
  const byKey = new Map(logs.map((l) => [`${l.userId}:${l.dayKey}`, l]));
  const plan = dayKeys.length ? await getDb().kefaretPlan.findFirst({ where: { groupId: group.id, userId: meId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }) : null;
  const usedDays = plan ? (await getDb().readingLog.findMany({ where: { kefaretPlanId: plan.id, kefaret: { gt: 0 } }, select: { dayKey: true }, orderBy: { dayKey: "asc" } })).map((l) => l.dayKey) : [];
  const now = new Date();
  const cards: Record<string, DayCard> = {};
  for (const dayKey of dayKeys) {
    const p = periodFor(dayKey, group);
    const open = now >= p.start && now < p.deadline;
    const card: DayCard = { dayKey, start: p.start.toISOString(), deadline: p.deadline.toISOString(), open, read: [], min: [], none: [], pending: [], me: null, penaltyTotal: 0, penaltyFinal: false };
    let projected = 0;
    for (const m of members) {
      // O gün başlamadan katılmayanlara ceza yazılmaz ama okumalarını bildirebilirler
      const eligible = m.joinedAt <= p.start;
      const log = byKey.get(`${m.userId}:${dayKey}`);
      const r = rulesFor(group, m);
      const target = log?.requiredPages ?? r.targetPages;
      const min = log ? log.minPages : r.minPages;
      if (m.userId === meId) {
        const logged = new Map(parseBookLogs(log?.books).map((b) => [b.id, b]));
        const books = r.books.map((b) => ({ id: b.id, title: b.title, target: b.targetPages, min: b.minPages, pages: logged.get(b.id)?.pages ?? null, linked: linked.get(b.id) }));
        // Eser bazında kaydı olmayan eski bildirimler tek esere yazılır
        if (log && !logged.size && books.length === 1) books[0].pages = log.pages;
        card.me = {
          eligible,
          pages: log?.pages ?? null,
          target,
          min,
          teamName: r.teamName,
          books,
          kefaret: log?.kefaret ?? 0,
          fine: { min: penaltyFor({ ...r, targetPages: target, minPages: min }, min), none: penaltyFor({ ...r, targetPages: target, minPages: min }, 0) },
          plan:
            plan && open && dayKey >= plan.startDay
              ? {
                  planId: plan.id,
                  dailyExtra: plan.dailyExtra,
                  days: plan.days,
                  doneDays: plan.doneDays,
                  discountTotal: plan.discountTotal,
                  earned: plan.earned,
                  startDay: plan.startDay,
                  discountPercent: plan.discountPercent,
                  usedDays,
                }
              : null,
        };
      }
      // Günün hasılatı: bildirmeyen herkes "okumadı" sayılır (en kötü durum); okudukça düşer
      if (eligible) projected += penaltyFor({ ...r, targetPages: target, minPages: min }, log?.pages ?? 0);
      if (!eligible && !log) continue;
      const person = { id: m.user.id, name: m.user.name, imageUrl: m.user.imageUrl, initial: m.user.initial, pages: log?.pages ?? null, required: target, ...(log?.kefaret ? { kefaret: log.kefaret } : {}) };
      if (!log) (open ? card.pending : card.none).push(person);
      else card[categoryOf(log.pages, { targetPages: target, minPages: min })].push(person);
    }
    // Ceza hesabı yapılmış günlerde (lastSettledDay) yazılan cezalar esas alınır
    card.penaltyFinal = !open && (written.has(dayKey) || (!!group.lastSettledDay && group.lastSettledDay >= dayKey));
    card.penaltyTotal = card.penaltyFinal ? (written.get(dayKey) ?? 0) : projected;
    cards[dayKey] = card;
  }
  return cards;
}
