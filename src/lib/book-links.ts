import "server-only";
import type { Group, Team } from "@prisma/client";
import { getDb } from "./db";
import { publish } from "./realtime";
import { booksOf, parseBookLogs, rulesFor, teamsActive, type BookLog } from "./rules";
import { openPeriod } from "./schedule";

// ---------- Eser adı benzerliği ----------

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Karşılaştırma için sadeleştirilmiş eser adı */
export function normalizeTitle(t: string) {
  return t
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (ch) => TR[ch] ?? ch)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(s: string) {
  const x = s.replace(/ /g, "");
  const out = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) out.set(x.slice(i, i + 2), (out.get(x.slice(i, i + 2)) ?? 0) + 1);
  return out;
}

/** 0–1 arası benzerlik: aynı ad 1, biri diğerini içeriyorsa 0.9, aksi halde harf ikilisi (Dice) ve kelime örtüşmesinin büyüğü */
export function titleSimilarity(a: string, b: string) {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))) return 0.9;
  const bx = bigrams(x);
  const by = bigrams(y);
  let common = 0;
  for (const [k, n] of bx) common += Math.min(n, by.get(k) ?? 0);
  const total = [...bx.values()].reduce((s, n) => s + n, 0) + [...by.values()].reduce((s, n) => s + n, 0);
  const dice = total ? (2 * common) / total : 0;
  const wx = new Set(x.split(" ").filter((w) => w.length > 2));
  const wy = new Set(y.split(" ").filter((w) => w.length > 2));
  const inter = [...wx].filter((w) => wy.has(w)).length;
  const jac = wx.size + wy.size - inter ? inter / (wx.size + wy.size - inter) : 0;
  return Math.max(dice, jac);
}

export const SIMILAR = 0.55;

// ---------- Kullanıcının eserleri ----------

export type MyBook = { groupId: string; groupName: string; bookId: string; title: string; target: number; min: number };

/** Kullanıcının hâlâ üye olduğu gruplardaki (kendi ekibine göre) eserler */
export async function myBooks(userId: string, excludeGroupId?: string): Promise<MyBook[]> {
  const ms = await getDb().groupMember.findMany({ where: { userId, status: "ACTIVE" }, include: { group: { include: { teams: true } } } });
  const out: MyBook[] = [];
  for (const m of ms) {
    if (m.groupId === excludeGroupId) continue;
    for (const b of rulesFor(m.group, m).books) {
      if (b.id === "genel") continue; // eser girilmemiş eski gruplar
      out.push({ groupId: m.groupId, groupName: m.group.name, bookId: b.id, title: b.title, target: b.targetPages, min: b.minPages });
    }
  }
  return out;
}

/** Katılınacak grubun (seçilen ekibe göre) eserleri */
function groupBooks(g: Group & { teams: Team[] }, teamId?: string | null) {
  const team = teamsActive(g) && teamId ? g.teams.find((t) => t.id === teamId) : null;
  if (teamsActive(g) && !team) {
    // Ekip seçilmediyse tüm ekiplerin eserleri (aynı eser bir kez)
    const seen = new Map<string, ReturnType<typeof booksOf>[number]>();
    for (const t of g.teams) for (const b of booksOf(t)) if (!seen.has(b.id)) seen.set(b.id, b);
    return [...seen.values()];
  }
  return booksOf(team ?? g);
}

export type BookMatch = { book: { id: string; title: string; target: number }; other: MyBook; score: number };

/** Katılmadan önce: gruptaki eserlerle kullanıcının diğer gruplarındaki eserleri karşılaştırır */
export async function findBookMatches(userId: string, groupId: string, teamId?: string | null): Promise<BookMatch[]> {
  const db = getDb();
  const g = await db.group.findUnique({ where: { id: groupId }, include: { teams: true } });
  if (!g) return [];
  // Gizli grubun eserleri yalnızca üyeye ya da davet edilene gösterilir
  if (g.visibility !== "PUBLIC") {
    const [member, invite] = await Promise.all([
      db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { id: true } }),
      db.invitation.findFirst({ where: { groupId, inviteeId: userId, status: "PENDING" }, select: { id: true } }),
    ]);
    if (!member && !invite) return [];
  }
  const mine = await myBooks(userId, groupId);
  const out: BookMatch[] = [];
  for (const b of groupBooks(g, teamId)) {
    if (b.id === "genel") continue;
    for (const o of mine) {
      const score = titleSimilarity(b.title, o.title);
      if (score >= SIMILAR) out.push({ book: { id: b.id, title: b.title, target: b.targetPages }, other: o, score: Math.round(score * 100) / 100 });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export type LinkInput = { bookId: string; linkGroupId: string; linkBookId: string };

/** "Aynı eser" denilen eşleşmeleri iki yönlü kaydeder (yalnızca kullanıcının aktif üyesi olduğu gruplar için) */
export async function saveBookLinks(userId: string, groupId: string, links: LinkInput[]) {
  if (!links.length) return 0;
  const db = getDb();
  const active = new Set((await db.groupMember.findMany({ where: { userId, status: "ACTIVE" }, select: { groupId: true } })).map((m) => m.groupId));
  const rows = links
    .filter((l) => l.linkGroupId !== groupId && active.has(l.linkGroupId) && l.bookId && l.linkBookId)
    .flatMap((l) => [
      { userId, groupId, bookId: l.bookId, linkGroupId: l.linkGroupId, linkBookId: l.linkBookId },
      { userId, groupId: l.linkGroupId, bookId: l.linkBookId, linkGroupId: groupId, linkBookId: l.bookId },
    ]);
  if (!rows.length) return 0;
  // Aynı eser/grup çifti için eski bağ varsa yenisiyle değiştir
  for (const r of rows) await db.bookLink.deleteMany({ where: { userId, groupId: r.groupId, bookId: r.bookId, linkGroupId: r.linkGroupId } });
  const res = await db.bookLink.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

/** Formdan gelen JSON'u doğrular */
export function parseLinks(v: unknown): LinkInput[] {
  try {
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(arr)) return [];
    return arr
      .slice(0, 30)
      .filter((x) => x && typeof x.bookId === "string" && typeof x.linkGroupId === "string" && typeof x.linkBookId === "string")
      .map((x) => ({ bookId: String(x.bookId).slice(0, 40), linkGroupId: String(x.linkGroupId).slice(0, 40), linkBookId: String(x.linkBookId).slice(0, 40) }));
  } catch {
    return [];
  }
}

/**
 * Bir grupta bildirilen eser sayfalarını, kullanıcının "aynı eser" dediği diğer gruplara da yansıtır.
 * Diğer grupta hedef kadar sayılır (fazlası değil) ve oradaki kayıt yalnızca artırılır, hiç azaltılmaz.
 */
export async function propagateLinkedBooks(userId: string, groupId: string, books: BookLog[]) {
  const db = getDb();
  const read = books.filter((b) => (b.pages ?? 0) > 0);
  if (!read.length) return;
  const links = await db.bookLink.findMany({ where: { userId, groupId, bookId: { in: read.map((b) => b.id) } } });
  if (!links.length) return;
  const byGroup = new Map<string, { linkBookId: string; pages: number }[]>();
  for (const l of links) {
    const pages = read.find((b) => b.id === l.bookId)!.pages!;
    byGroup.set(l.linkGroupId, [...(byGroup.get(l.linkGroupId) ?? []), { linkBookId: l.linkBookId, pages }]);
  }
  for (const [gid, items] of byGroup) {
    const member = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: gid, userId } }, include: { group: { include: { teams: true } } } });
    if (!member || member.status !== "ACTIVE") continue;
    const period = openPeriod(new Date(), member.group);
    if (!period) continue;
    const rules = rulesFor(member.group, member);
    const existing = await db.readingLog.findUnique({ where: { groupId_userId_dayKey: { groupId: gid, userId, dayKey: period.dayKey } } });
    const prev = new Map(parseBookLogs(existing?.books).map((b) => [b.id, b.pages]));
    let changed = false;
    const next: BookLog[] = rules.books.map((b) => {
      const cur = prev.get(b.id) ?? null;
      const item = items.find((i) => i.linkBookId === b.id);
      if (!item) return { id: b.id, title: b.title, target: b.targetPages, min: b.minPages, pages: cur };
      const val = Math.min(item.pages, b.targetPages);
      if (cur == null || val > cur) {
        changed = true;
        return { id: b.id, title: b.title, target: b.targetPages, min: b.minPages, pages: val };
      }
      return { id: b.id, title: b.title, target: b.targetPages, min: b.minPages, pages: cur };
    });
    if (!changed) continue;
    const snapshot = { pages: next.reduce((s, b) => s + (b.pages ?? 0), 0), requiredPages: rules.targetPages, minPages: rules.minPages, books: next };
    await db.readingLog.upsert({
      where: { groupId_userId_dayKey: { groupId: gid, userId, dayKey: period.dayKey } },
      create: { groupId: gid, userId, dayKey: period.dayKey, ...snapshot },
      update: snapshot,
    });
    await publish(gid, { type: "refresh", reason: "day" });
  }
}

/** Gün kartında göstermek için: bu gruptaki eserler hangi gruplarla ortak */
export async function linkedGroupNames(userId: string, groupId: string) {
  const db = getDb();
  const links = await db.bookLink.findMany({ where: { userId, groupId } });
  if (!links.length) return new Map<string, string[]>();
  const groups = await db.group.findMany({ where: { id: { in: [...new Set(links.map((l) => l.linkGroupId))] } }, select: { id: true, name: true } });
  const active = new Set((await db.groupMember.findMany({ where: { userId, status: "ACTIVE", groupId: { in: groups.map((g) => g.id) } }, select: { groupId: true } })).map((m) => m.groupId));
  const out = new Map<string, string[]>();
  for (const l of links) {
    if (!active.has(l.linkGroupId)) continue;
    const name = groups.find((g) => g.id === l.linkGroupId)?.name;
    if (name) out.set(l.bookId, [...(out.get(l.bookId) ?? []), name]);
  }
  return out;
}
