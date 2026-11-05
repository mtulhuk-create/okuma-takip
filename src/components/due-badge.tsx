"use client";

import { AlarmClockOff, CalendarClock, Hourglass, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/schedule";
import { Countdown } from "./countdown";

export type DueInfo = {
  dueAt: string | Date;
  status: string;
  originalDueAt?: string | Date | null;
  extensions?: number;
  decisionUntil?: string | Date | null;
};

const iso = (d: string | Date) => (typeof d === "string" ? d : d.toISOString());

/**
 * Borcun yanında vade bilgisi: son tarih + kalan süre.
 * Ek süre verildiyse sarı kum saati ve ilk vade; vade dolduysa kırmızı uyarı ve karar süresi.
 */
export function DueBadge({ due, compact }: { due: DueInfo; compact?: boolean }) {
  const extended = (due.extensions ?? 0) > 0;
  if (due.status === "OVERDUE") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
        <AlarmClockOff className="size-3.5" /> Vade doldu
        {due.decisionUntil && !compact && (
          <span className="font-normal">
            · karar için <Countdown to={iso(due.decisionUntil)} label="" />
          </span>
        )}
      </span>
    );
  }
  if (due.status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
        <ShieldAlert className="size-3.5" /> Ödeme bildirildi · onay bekliyor
      </span>
    );
  }
  return (
    <span
      title={extended && due.originalDueAt ? `İlk vade ${formatDateTime(new Date(due.originalDueAt))}` : undefined}
      className={`inline-flex flex-wrap items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        extended ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted text-foreground"
      }`}
    >
      {extended ? <Hourglass className="size-3.5" /> : <CalendarClock className="size-3.5" />}
      {extended && <span>Ek süre{(due.extensions ?? 0) > 1 ? ` ×${due.extensions}` : ""} ·</span>}
      {!compact && <span className="font-normal">{formatDateTime(new Date(due.dueAt))} ·</span>}
      <Countdown to={iso(due.dueAt)} />
    </span>
  );
}
