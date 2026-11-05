"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { HistoryGrid, RangePicker, StatsLine, StreakBadge, useHistory, type Stats } from "./history-grid";

type Row = { start: string; cells: string; stats: Stats; streak: number };
type Data = { all: Row | null; groups: (Row & { group: { id: string; name: string } })[] };

/** Bugün sayfası: yalnızca kullanıcının kendi okuma geçmişi ve serisi */
export function MyHistory({ initial }: { initial: Data }) {
  const { range, setRange, data, loading } = useHistory<Data>((r) => `/api/m/history?range=${r}`, initial);
  if (!data?.groups.length) return null;
  const multi = !!data.all && data.groups.length > 1;
  const streak = multi ? data.all!.streak : data.groups[0].streak;
  return (
    <section className={`card space-y-3 p-3.5 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <RangePicker value={range} onChange={setRange} />
          <p className="px-1 text-[11px] leading-tight text-muted-foreground">Yalnızca senin okumaların</p>
        </div>
        <StreakBadge n={streak ?? 0} />
      </div>
      {multi && (
        <div className="space-y-2 rounded-xl bg-muted/50 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Layers className="size-4 text-primary" /> Tüm gruplar
            </p>
            <StatsLine stats={data.all!.stats} />
          </div>
          <HistoryGrid start={data.all!.start} cells={data.all!.cells} />
        </div>
      )}
      <div className="divide-y divide-border">
        {data.groups.map((g) => (
          <div key={g.group.id} className="space-y-2 py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <Link href={`/gruplar/${g.group.id}`} className="truncate text-sm font-semibold hover:underline">
                  {g.group.name}
                </Link>
                {multi && <StreakBadge n={g.streak ?? 0} size="xs" />}
              </span>
              <StatsLine stats={g.stats} />
            </div>
            <HistoryGrid start={g.start} cells={g.cells} />
          </div>
        ))}
      </div>
    </section>
  );
}
