"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HistoryGrid, MenuPicker, RangePicker, StatsLine, StreakBadge, useHistory, type Stats } from "./history-grid";

type Row = { start: string; cells: string; stats: Stats; streak: number };
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
    <section className={`card space-y-2 p-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
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
        <StreakBadge n={row.streak ?? 0} size="xs" />
      </div>
      <HistoryGrid start={row.start} cells={row.cells} />
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
