// Okuma kuralları: grup geneli ya da (ekipler açıksa) üyenin ekibine göre.
export type PenaltyMode = "FIXED" | "PER_PAGE";
export type Rules = { penaltyMode: PenaltyMode; targetPages: number; minPages: number; penaltyAmount: number; minDiscount: number };
type TeamLike = Rules & { id: string; name: string };
type GroupLike = Rules & { teamsEnabled: boolean; teams?: TeamLike[] };

export const pickRules = (r: Rules): Rules => ({
  penaltyMode: r.penaltyMode,
  targetPages: r.targetPages,
  minPages: r.minPages,
  penaltyAmount: r.penaltyAmount,
  minDiscount: r.minDiscount,
});

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
export function penaltyFor(r: Rules, pages: number) {
  if (pages >= r.targetPages) return 0;
  const reachedMin = pages >= r.minPages;
  if (r.penaltyMode === "PER_PAGE") return r.penaltyAmount * (r.targetPages - pages);
  return reachedMin ? Math.round((r.penaltyAmount * (100 - r.minDiscount)) / 100) : r.penaltyAmount;
}

export function describePenalty(r: Rules) {
  if (r.penaltyMode === "PER_PAGE") return `Eksik sayfa başına ${r.penaltyAmount} TL`;
  return r.minDiscount > 0
    ? `${r.penaltyAmount} TL · alt sınırda %${r.minDiscount} indirim`
    : `${r.penaltyAmount} TL / gün`;
}
