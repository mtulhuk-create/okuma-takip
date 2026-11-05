"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { HistoryGrid, RangePicker, StatsLine, useHistory, type Stats } from "./history-grid";

type Row = { start: string; cells: string; stats: Stats };
type Data = { all: Row | null; groups: (Row & { group: { id: string; name: string } })[] };

/** Bugün sayfası: yalnızca kullanıcının kendi okuma geçmişi */
export function MyHistory({ initial }: { initial: Data }) {
  const { range, setRange, data, loading } = useHistory<Data>((r) => `/api/m/history?range=${r}`, initial);
  if (!data?.groups.length) return null;
  return (
    <section className={`card space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <RangePicker value={range} onChange={setRange} />
        <span className="text-xs text-muted-foreground">Yalnızca senin okumaların</span>
      </div>
      {data.all && data.groups.length > 1 && (
        <div className="space-y-2 rounded-xl bg-muted/50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="size-4 text-primary" /> Tüm gruplar
          </p>
          <HistoryGrid start={data.all.start} cells={data.all.cells} />
          <StatsLine stats={data.all.stats} />
        </div>
      )}
      {data.groups.map((g) => (
        <div key={g.group.id} className="space-y-2">
          <Link href={`/gruplar/${g.group.id}`} className="block truncate text-sm font-semibold hover:underline">
            {g.group.name}
          </Link>
          <HistoryGrid start={g.start} cells={g.cells} />
          <StatsLine stats={g.stats} />
        </div>
      ))}
    </section>
  );
}
