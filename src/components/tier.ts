// Ekip hiyerarşisi çerçeveleri (gruba özel): altın en şaşalı (çift halka), gümüş düz halka, bronz ince çizgi.
export type Tier = "gold" | "silver" | "bronze";

export const TIER_LABEL: Record<Tier, string> = { gold: "Altın ekip", silver: "Gümüş ekip", bronze: "Bronz ekip" };

/** Avatar çevresi */
export const AVATAR_FRAME: Record<Tier, string> = {
  gold: "ring-2 ring-[#d4a017] ring-offset-[1.5px] ring-offset-card shadow-[0_0_0_4px_rgba(243,217,139,0.55)]",
  silver: "ring-2 ring-[#a7b1bc] ring-offset-1 ring-offset-card",
  bronze: "ring-[1.5px] ring-[#b07040]",
};

/** Okuma geçmişi kutucukları çevresi */
export const CELL_FRAME: Record<Tier, string> = {
  gold: "ring-2 ring-[#d4a017] ring-offset-1 ring-offset-card",
  silver: "ring-[1.5px] ring-[#a7b1bc]",
  bronze: "ring-1 ring-[#b07040]",
};
