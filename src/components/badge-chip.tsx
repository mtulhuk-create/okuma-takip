import { Snail, Sparkles } from "lucide-react";

export type BadgeTag = { kind: "GOOD" | "BAD"; label: string };

/**
 * Ismin yanındaki rozet. İyi rozet: yeşil, tam yuvarlak, parıltı simgeli.
 * Latife (kötü) rozet: turuncu, köşeli ve kesik çizgili çerçeve, salyangoz simgeli.
 */
export function BadgeChip({ tag, className = "" }: { tag: BadgeTag; className?: string }) {
  if (tag.kind === "GOOD") {
    return (
      <span title="İyi rozet: 7 gün üst üste tam okudu" className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-1.5 py-px text-[10px] font-bold leading-4 text-white shadow-sm ${className}`}>
        <Sparkles className="size-3" strokeWidth={2.5} />
        {tag.label}
      </span>
    );
  }
  return (
    <span title="Latife rozeti: 7 gün tam okuyamadı" className={`inline-flex shrink-0 items-center gap-0.5 rounded-[3px] border border-dashed border-orange-400 bg-orange-50 px-1.5 py-px text-[10px] font-semibold leading-4 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300 ${className}`}>
      <Snail className="size-3" strokeWidth={2.5} />
      {tag.label}
    </span>
  );
}
