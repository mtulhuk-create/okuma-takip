"use client";

import { CalendarRange, EyeOff, X } from "lucide-react";
import { Avatar } from "../avatar";
import { StreakFlame } from "../day-card";
import { HistoryGrid, RANGE_LABELS, RangePicker, StatsLine, useHistory, type Range, type Stats } from "../history-grid";
import type { Tier } from "../tier";

type Data = {
  limited: boolean;
  rows: { user: { id: string; name: string; imageUrl: string | null }; me: boolean; start: string; cells: string; stats: Stats; streak?: { n: number; full: boolean } | null; tier?: Tier | null }[];
};
const LABELS: Record<Range, string> = { ...RANGE_LABELS, all: "Grup kurulduğundan beri" };

/** Sohbetten açılan okuma geçmişi çekmecesi */
export function GroupHistory({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { range, setRange, data, loading } = useHistory<Data>((r) => `/api/m/groups/${groupId}/history?range=${r}`);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-stretch sm:justify-end" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="pb-safe flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-card shadow-xl sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border p-4">
          <CalendarRange className="size-5 text-primary" />
          <h2 className="flex-1 font-bold">Okuma geçmişi</h2>
          <button className="btn-icon size-8" onClick={onClose} aria-label="Kapat">
            <X />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pt-3">
          <RangePicker value={range} onChange={setRange} labels={LABELS} />
        </div>
        <div className={`flex-1 space-y-4 overflow-y-auto p-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {!data && <div className="skeleton h-24" />}
          {data?.limited && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <EyeOff className="mt-0.5 size-4 shrink-0" />
              Diğer üyelerin geçmişini görmek için yöneticinin grup ayarlarından “Okuyucular birbirinin geçmişini görsün” seçeneğini açması gerekir.
            </p>
          )}
          {data?.rows.map((r) => (
            <div key={r.user.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Avatar name={r.user.name} src={r.user.imageUrl} initial={(r.user as { initial?: string }).initial} seed={r.user.id} size={28} frame={r.tier} />
                <span className="truncate text-sm font-semibold">
                  {r.user.name}
                  {r.me && <span className="font-normal text-muted-foreground"> (sen)</span>}
                </span>
                {/* Seri bu grubun okumalarından: ismin hemen sağında, alev içinde gün sayısı */}
                <StreakFlame s={r.streak} className="relative -ml-2" big />
              </div>
              <HistoryGrid start={r.start} cells={r.cells} frame={r.tier} />
              <StatsLine stats={r.stats} />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
