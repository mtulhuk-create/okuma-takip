// Okuma kuralları: grup geneli ya da (ekipler açıksa) üyenin ekibine göre.
export type PenaltyMode = "FIXED" | "PER_PAGE";
/** Okuma hesabı: sayfa ya da süre. MINUTES'ta hedef / alt sınır / okunan değerler dakikadır (15'in katları). */
export type ReadUnit = "PAGES" | "MINUTES";
export type Book = { id: string; title: string; targetPages: number; minPages: number };
export type Rules = { penaltyMode: PenaltyMode; readUnit: ReadUnit; targetPages: number; minPages: number; penaltyAmount: number; minDiscount: number; books: Book[] };
type RulesRow = Omit<Rules, "books" | "readUnit"> & { books: unknown; readUnit?: ReadUnit | null };

/** Süre hesabında adım (dakika) */
export const MINUTE_STEP = 15;

/** Süreyi okunur yazar: 45 dk, 1 sa, 1 sa 15 dk */
export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/** Miktarı birimiyle yazar: "50 sf" ya da "1 sa 15 dk"; long: "50 sayfa" */
export function formatAmount(n: number, unit: ReadUnit | null | undefined, long = false) {
  if (unit === "MINUTES") return formatMinutes(n);
  return long ? `${n} sayfa` : `${n} sf`;
}

/** Birimin adı (cümle içinde): "sayfa" / "dakika" */
export const unitWord = (unit: ReadUnit | null | undefined) => (unit === "MINUTES" ? "dakika" : "sayfa");
type TeamLike = RulesRow & { id: string; name: string };
type GroupLike = RulesRow & { teamsEnabled: boolean; teams?: TeamLike[]; framesEnabled?: boolean };

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
    readUnit: r.readUnit === "MINUTES" ? "MINUTES" : "PAGES",
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

/** Ekip hiyerarşisi çerçevesi */
export type Tier = "gold" | "silver" | "bronze";

/**
 * Ekip hiyerarşisi: ekibin günlük toplam tam sayfası (eserlerin hedefleri) en çok olan en üstte.
 * 1 ekip ya da hepsi eşitse çerçeve yok; 2 ekipte yalnızca üstteki altın; 3 ekipte altın ve gümüş
 * (en az okuyan çerçevesiz); 4 ve üstünde altın, gümüş, bronz, kalanlar çerçevesiz. Eşit sayfalı ekipler aynı çerçeveyi alır.
 */
export function teamTiers(group: GroupLike): Map<string, Tier> {
  const out = new Map<string, Tier>();
  // Grup ayarında çerçeveler kapalıysa hiç verilmez
  if (!teamsActive(group) || group.framesEnabled === false) return out;
  const teams = group.teams!;
  // Saat hesaplı ekipte 1 dakika 1 sayfa sayılır (sıralama için yaklaşık ölçü)
  const totals = teams.map((t) => ({ id: t.id, total: pickRules(t).targetPages }));
  const levels = [...new Set(totals.map((t) => t.total))].sort((a, b) => b - a);
  const tiers: Tier[] = teams.length === 2 ? ["gold"] : teams.length === 3 ? ["gold", "silver"] : ["gold", "silver", "bronze"];
  // En alt seviye hiçbir zaman çerçeve almaz (ör. 3 ekip 50-50-20: yalnızca 50'ler altın)
  const framed = Math.min(tiers.length, levels.length - 1);
  for (const t of totals) {
    const r = levels.indexOf(t.total);
    if (r < framed) out.set(t.id, tiers[r]);
  }
  return out;
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
export function penaltyFor(r: Pick<Rules, "penaltyMode" | "targetPages" | "minPages" | "penaltyAmount" | "minDiscount"> & { readUnit?: ReadUnit | null }, pages: number) {
  if (pages >= r.targetPages) return 0;
  const reachedMin = pages >= r.minPages;
  // Eksik başına ceza: sayfa hesabında her eksik sayfa, saat hesabında her eksik 15 dakika (başlanan dilim tam sayılır)
  if (r.penaltyMode === "PER_PAGE") return r.penaltyAmount * (r.readUnit === "MINUTES" ? Math.ceil((r.targetPages - pages) / MINUTE_STEP) : r.targetPages - pages);
  return reachedMin ? Math.round((r.penaltyAmount * (100 - r.minDiscount)) / 100) : r.penaltyAmount;
}

export function describePenalty(r: Pick<Rules, "penaltyMode" | "penaltyAmount" | "minDiscount"> & { readUnit?: ReadUnit | null }) {
  if (r.penaltyMode === "PER_PAGE") return r.readUnit === "MINUTES" ? `Eksik 15 dk başına ${r.penaltyAmount} TL` : `Eksik sayfa başına ${r.penaltyAmount} TL`;
  return r.minDiscount > 0 ? `${r.penaltyAmount} TL · alt sınırda %${r.minDiscount} indirim` : `${r.penaltyAmount} TL / gün`;
}

/** Günlük kayıtta eser bazında okunan sayfa */
export type BookLog = { id: string; title: string; pages: number | null; target: number; min: number };
export function parseBookLogs(v: unknown): BookLog[] {
  return Array.isArray(v) ? (v as BookLog[]).filter((b) => b && typeof b.id === "string") : [];
}
