import { TIER_COLOR, TIER_NOTCHES, type Tier } from "./tier";

/**
 * Ekip çerçevesinin çıkıntıları (avatardakiyle aynı): altın 4 kenar, gümüş üst + alt, bronz üst.
 * Kutunun (geçmiş kutucuğu, isim rozeti) kenar çizgisinin tam ortasına oturur.
 * offset: iç kenardan çizginin ortasına uzaklık (px); üst öğe `relative` olmalı.
 */
export function EdgeNotches({ tier, offset, d = 3 }: { tier: Tier; offset: number; d?: number }) {
  const out = `calc(100% + ${offset}px)`;
  const pos = { top: { left: "50%", top: -offset }, bottom: { left: "50%", top: out }, left: { left: -offset, top: "50%" }, right: { left: out, top: "50%" } } as const;
  return (
    <>
      {TIER_NOTCHES[tier].map((p) => (
        <span
          key={p}
          aria-hidden
          className="pointer-events-none absolute rotate-45 rounded-[0.5px] border-[0.6px] border-card"
          style={{ ...pos[p], width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, backgroundColor: TIER_COLOR[tier] }}
        />
      ))}
    </>
  );
}
