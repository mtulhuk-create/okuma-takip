// Okuma kuralları: grup geneli ya da (ekipler açıksa) üyenin ekibine göre.
export type PenaltyMode = "FIXED" | "PER_PAGE";
export type Book = { id: string; title: string; targetPages: number; minPages: number };
export type Rules = { penaltyMode: PenaltyMode; targetPages: number; minPages: number; penaltyAmount: number; minDiscount: number; books: Book[] };
type RulesRow = Omit<Rules, "books"> & { books: unknown };
type TeamLike = RulesRow & { id: string; name: string };
type GroupLike = RulesRow & { teamsEnabled: boolean; teams?: TeamLike[] };

function parseBooks(v: unknown): Book[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((b): b is Book => !!b && typeof b === "object" && typeof (b as Book).id === "string")
    .map((b) => ({ id: b.id, title: String(b.title ?? ""), targetPages: Number(b.targetPages) || 0, minPages: Number(b.minPages) || 0 }));
}

/** Eser listesi yoksa (eski gruplar) toplam hedef tek bir "Günlük okuma" eseri sayılır */
export function booksOf(r: Pick<Rules, "targetPages" | "minPages"> & { books: unknown }): Book[] {
  const books = parseBooks(r.books);
  return books.length ? books : [{ id: "genel", title: "Günlük okuma", targetPages: r.targetPages, minPages: r.minPages }];
}

export const pickRules = (r: RulesRow): Rules => {
  const books = booksOf(r);
  return {
    penaltyMode: r.penaltyMode,
    targetPages: books.reduce((s, b) => s + b.targetPages, 0),
    minPages: books.reduce((s, b) => s + b.minPages, 0),
    penaltyAmount: r.penaltyAmount,
    minDiscount: r.minDiscount,
    books,
  };
};

/** Ekipler yalnızca açık ve en az 2 ekip varsa devrededir */
export function teamsActive(group: { teamsEnabled: boolean; teams?: unknown[] }) {
  return group.teamsEnabled && (group.teams?.length ?? 0) >= 2;
}

export function rulesFor(group: GroupLike, member: { teamId: string | null }): Rules & { teamName: string | null } {
  const team = teamsActive(group) ? group.teams!.find((t) => t.id === member.teamId) : undefined;
  return { ...pickRules(team ?? group), teamName: team?.name ?? null };
}

export type Category = "read" | "min" | "none";

/** okudu: hedef ve üstü · min: alt sınır ile hedef arası · none: alt sınırın altı */
export function categoryOf(pages: number, r: Pick<Rules, "targetPages" | "minPages">): Category {
  if (pages >= r.targetPages) return "read";
  if (pages >= r.minPages) return "min";
  return "none";
}

/** Bir günün cezası (TL). Hedefi tutturan ceza ödemez; sabit cezada alt sınırı tutturan indirimli öder. */
export function penaltyFor(r: Pick<Rules, "penaltyMode" | "targetPages" | "minPages" | "penaltyAmount" | "minDiscount">, pages: number) {
  if (pages >= r.targetPages) return 0;
  const reachedMin = pages >= r.minPages;
  if (r.penaltyMode === "PER_PAGE") return r.penaltyAmount * (r.targetPages - pages);
  return reachedMin ? Math.round((r.penaltyAmount * (100 - r.minDiscount)) / 100) : r.penaltyAmount;
}

export function describePenalty(r: Pick<Rules, "penaltyMode" | "penaltyAmount" | "minDiscount">) {
  if (r.penaltyMode === "PER_PAGE") return `Eksik sayfa başına ${r.penaltyAmount} TL`;
  return r.minDiscount > 0 ? `${r.penaltyAmount} TL · alt sınırda %${r.minDiscount} indirim` : `${r.penaltyAmount} TL / gün`;
}

/** Günlük kayıtta eser bazında okunan sayfa */
export type BookLog = { id: string; title: string; pages: number | null; target: number; min: number };
export function parseBookLogs(v: unknown): BookLog[] {
  return Array.isArray(v) ? (v as BookLog[]).filter((b) => b && typeof b.id === "string") : [];
}
