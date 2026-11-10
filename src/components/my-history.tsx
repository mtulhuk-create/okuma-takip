"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Tier } from "./tier";
import { HistoryGrid, MenuPicker, RangePicker, StatsLine, STREAK_MIN, StreakBadge, useHistory, type Stats } from "./history-grid";

type Row = { start: string; cells: string; stats: Stats; streak: number; fullStreak?: number; tier?: Tier | null };
type Data = { all: Row | null; groups: (Row & { group: { id: string; name: string } })[] };

/** Bugün sayfası: kendi okuma geçmişin. Varsayılan tüm gruplar; menüden tek grup seçilebilir. */
export function MyHistory({ initial }: { initial: Data }) {
  const { range, setRange, data, loading } = useHistory<Data>((r) => `/api/m/history?range=${r}`, initial);
  const [sel, setSel] = useState<string>("all");
  if (!data?.groups.length) return null;
  const multi = !!data.all && data.groups.length > 1;
  const group = data.groups.find((g) => g.group.id === sel);
  const row: Row = (sel === "all" || !group) && multi ? data.all! : (group ?? data.groups[0]);
  const shownGroup = (sel === "all" || !group) && multi ? null : (group ?? data.groups[0]).group;

  return (
    <section className={`card relative space-y-2 p-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {/* Seri rozeti: kartın sağ üst kenarında, hafif eğik */}
      {/* Seri ve ekip çerçevesi gruba özel: yalnızca tek grup gösterilirken (tüm gruplar birleşiminde yok).
          Tam seri (üst üste hedef) öncelikli; yoksa alt sınır dahil seri */}
      {shownGroup && ((row.fullStreak ?? 0) >= STREAK_MIN ? <StreakBadge n={row.fullStreak!} full size="xs" sticker /> : <StreakBadge n={row.streak ?? 0} size="xs" sticker />)}
      <div className="flex items-center gap-1.5">
        <RangePicker value={range} onChange={setRange} />
        <div className="min-w-0 flex-1">
          {multi ? (
            <MenuPicker
              value={group ? sel : "all"}
              onChange={setSel}
              icon={<Layers className="size-3.5 shrink-0 text-primary" />}
              options={[{ value: "all", label: "Tüm gruplar" }, ...data.groups.map((g) => ({ value: g.group.id, label: g.group.name }))]}
            />
          ) : (
            <Link href={`/gruplar/${data.groups[0].group.id}`} className="block truncate text-xs font-semibold text-muted-foreground hover:underline">
              {data.groups[0].group.name}
            </Link>
          )}
        </div>
      </div>
      <HistoryGrid start={row.start} cells={row.cells} frame={shownGroup ? row.tier : null} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
        <StatsLine stats={row.stats} />
        <span className="text-[10px] text-muted-foreground">
          Yalnızca senin okumaların
          {shownGroup && multi && (
            <>
              {" · "}
              <Link href={`/gruplar/${shownGroup.id}`} className="underline">
                gruba git
              </Link>
            </>
          )}
        </span>
      </div>
    </section>
  );
}
