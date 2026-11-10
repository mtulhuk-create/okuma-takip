// Ekip hiyerarşisi çerçeveleri (gruba özel): yalnızca halka; üzerinde küçük baklava çıkıntılar
// (altın 4, gümüş 2, bronz 1 üstte). Hepsi sade.
export type Tier = "gold" | "silver" | "bronze";

export const TIER_LABEL: Record<Tier, string> = { gold: "Altın ekip", silver: "Gümüş ekip", bronze: "Bronz ekip" };

export const TIER_COLOR: Record<Tier, string> = { gold: "#d4a017", silver: "#a7b1bc", bronze: "#b07040" };

/** Avatar çevresindeki halka (tüm çerçevelerde aynı, ince) */
export const AVATAR_FRAME: Record<Tier, string> = {
  gold: "ring-[1.25px] ring-[#d4a017]",
  silver: "ring-[1.25px] ring-[#a7b1bc]",
  bronze: "ring-[1.25px] ring-[#b07040]",
};

/** Halkadaki çıkıntılar (üst, alt, sol, sağ) */
export const TIER_NOTCHES: Record<Tier, ("top" | "bottom" | "left" | "right")[]> = { gold: ["top", "bottom", "left", "right"], silver: ["top", "bottom"], bronze: ["top"] };

/** Okuma geçmişi kutucukları çevresi */
export const CELL_FRAME: Record<Tier, string> = {
  gold: "ring-[1.5px] ring-[#d4a017]",
  silver: "ring-[1.5px] ring-[#a7b1bc]",
  bronze: "ring-[1.5px] ring-[#b07040]",
};
