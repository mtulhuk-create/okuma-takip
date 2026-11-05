import "server-only";
import type { Group, Team } from "@prisma/client";
import { getDb } from "./db";
import { categoryOf, parseBookLogs, penaltyFor, rulesFor, type BookLog } from "./rules";
import { periodFor } from "./schedule";

export type DayPerson = { id: string; name: string; imageUrl: string | null; pages: number | null; required: number };
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
  me: { eligible: boolean; pages: number | null; target: number; min: number; teamName: string | null; books: BookLog[] } | null;
  /** O günün toplam cezası (TL). Gün kapandıysa yazılan cezalar, açıksa şu ana kadarki bildirimlere göre */
  penaltyTotal: number;
  /** Kesinleşmiş mi (gün kapandı ve cezalar yazıldı) */
  penaltyFinal: boolean;
};

type Member = { userId: string; teamId: string | null; joinedAt: Date; user: { id: string; name: string; imageUrl: string | null } };

/** Belirtilen günler için grubun okuma durumunu kategorilere ayırır (tek sorgu). */
export async function getDayCards(group: Group & { teams: Team[] }, members: Member[], dayKeys: string[], meId: string) {
  const [logs, penalties] = dayKeys.length
    ? await Promise.all([
        getDb().readingLog.findMany({ where: { groupId: group.id, dayKey: { in: dayKeys } } }),
        getDb().penalty.groupBy({ by: ["dayKey"], where: { groupId: group.id, dayKey: { in: dayKeys }, status: { not: "WAIVED" } }, _sum: { amount: true } }),
      ])
    : [[], []];
  const written = new Map(penalties.map((p) => [p.dayKey, p._sum.amount ?? 0]));
  const byKey = new Map(logs.map((l) => [`${l.userId}:${l.dayKey}`, l]));
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
        const books = r.books.map((b) => ({ id: b.id, title: b.title, target: b.targetPages, min: b.minPages, pages: logged.get(b.id)?.pages ?? null }));
        // Eser bazında kaydı olmayan eski bildirimler tek esere yazılır
        if (log && !logged.size && books.length === 1) books[0].pages = log.pages;
        card.me = { eligible, pages: log?.pages ?? null, target, min, teamName: r.teamName, books };
      }
      // Ceza tahmini: bildirenler (gün açıkken) ya da herkes (gün kapandıysa, bildirmeyen 0 sayfa)
      if (eligible && (log || !open)) projected += penaltyFor({ ...r, targetPages: target, minPages: min }, log?.pages ?? 0);
      if (!eligible && !log) continue;
      const person = { id: m.user.id, name: m.user.name, imageUrl: m.user.imageUrl, pages: log?.pages ?? null, required: target };
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
