import "server-only";
import type { Group, Team } from "@prisma/client";
import { getDb } from "./db";
import { categoryOf, rulesFor } from "./rules";
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
  me: { eligible: boolean; pages: number | null; target: number; min: number; teamName: string | null } | null;
};

type Member = { userId: string; teamId: string | null; joinedAt: Date; user: { id: string; name: string; imageUrl: string | null } };

/** Belirtilen günler için grubun okuma durumunu kategorilere ayırır (tek sorgu). */
export async function getDayCards(group: Group & { teams: Team[] }, members: Member[], dayKeys: string[], meId: string) {
  const logs = dayKeys.length ? await getDb().readingLog.findMany({ where: { groupId: group.id, dayKey: { in: dayKeys } } }) : [];
  const byKey = new Map(logs.map((l) => [`${l.userId}:${l.dayKey}`, l]));
  const now = new Date();
  const cards: Record<string, DayCard> = {};
  for (const dayKey of dayKeys) {
    const p = periodFor(dayKey, group);
    const open = now >= p.start && now < p.deadline;
    const card: DayCard = { dayKey, start: p.start.toISOString(), deadline: p.deadline.toISOString(), open, read: [], min: [], none: [], pending: [], me: null };
    for (const m of members) {
      // O gün başlamadan katılmayanlara ceza yazılmaz ama okumalarını bildirebilirler
      const eligible = m.joinedAt <= p.start;
      const log = byKey.get(`${m.userId}:${dayKey}`);
      const r = rulesFor(group, m);
      const target = log?.requiredPages ?? r.targetPages;
      const min = log ? log.minPages : r.minPages;
      if (m.userId === meId) card.me = { eligible, pages: log?.pages ?? null, target, min, teamName: r.teamName };
      if (!eligible && !log) continue;
      const person = { id: m.user.id, name: m.user.name, imageUrl: m.user.imageUrl, pages: log?.pages ?? null, required: target };
      if (!log) (open ? card.pending : card.none).push(person);
      else card[categoryOf(log.pages, { targetPages: target, minPages: min })].push(person);
    }
    cards[dayKey] = card;
  }
  return cards;
}
