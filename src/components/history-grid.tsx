"use client";

import { BookOpen, Check, CheckCheck, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type Range = "7d" | "1m" | "3m" | "1y" | "all";
export const RANGE_LABELS: Record<Range, string> = { "7d": "Son 7 gün", "1m": "Son 1 ay", "3m": "Son 3 ay", "1y": "Son 1 yıl", all: "Üye olduğumdan beri" };
export type Stats = { read: number; min: number; none: number; pages: number };

const COLOR: Record<string, string> = {
  r: "bg-emerald-500",
  m: "bg-amber-400",
  n: "bg-rose-500",
  p: "bg-transparent ring-1 ring-inset ring-muted-foreground/40",
  "-": "bg-muted",
};
const TITLE: Record<string, string> = { r: "Okudu", m: "Alt sınır", n: "Okumadı", p: "Bekleniyor", "-": "Üye değildi" };
const DOW = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const addDays = (key: string, n: number) => new Date(Date.parse(key) + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (key: string) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

/** Gün durumlarını gösterir: kısa aralıkta kutular, uzunda haftalık ısı haritası */
export function HistoryGrid({ start, cells }: { start: string; cells: string }) {
  if (cells.length <= 14) {
    return (
      <div className="flex gap-1">
        {[...cells].map((c, i) => {
          const key = addDays(start, i);
          const dow = new Date(Date.parse(key)).getUTCDay();
          const today = i === cells.length - 1;
          return (
            <div key={key} className="flex flex-1 flex-col items-center gap-1" title={`${fmt(key)} · ${TITLE[c]}`}>
              <span className={`text-[10px] font-semibold ${today ? "text-primary" : "text-muted-foreground"}`}>{DOW[dow]}</span>
              <span className={`flex aspect-square w-full max-w-9 items-center justify-center rounded-md ${COLOR[c]}`}>
                {c === "r" && <CheckCheck className="size-3.5 text-white" strokeWidth={3} />}
                {c === "m" && <Check className="size-3.5 text-white" strokeWidth={3} />}
                {c === "n" && <X className="size-3.5 text-white" strokeWidth={3} />}
              </span>
              <span className="text-[10px] text-muted-foreground">{Number(key.slice(8))}</span>
            </div>
          );
        })}
      </div>
    );
  }
  // Pazartesi başlayan haftalar (sütun) × günler (satır)
  const firstDow = (new Date(Date.parse(start)).getUTCDay() + 6) % 7;
  const padded = "x".repeat(firstDow) + cells;
  const weeks = Math.ceil(padded.length / 7);
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="inline-grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}>
        {[...padded].map((c, i) => {
          if (c === "x") return <span key={i} className="size-3" />;
          const key = addDays(start, i - firstDow);
          return <span key={i} title={`${fmt(key)} · ${TITLE[c]}`} className={`size-3 rounded-[3px] ${COLOR[c]}`} />;
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{fmt(start)}</span>
        <span>{fmt(addDays(start, cells.length - 1))}</span>
      </div>
    </div>
  );
}

export function StatsLine({ stats }: { stats: Stats }) {
  const items = [
    { Icon: CheckCheck, n: stats.read, cls: "text-emerald-600 dark:text-emerald-400", label: "okudu" },
    { Icon: Check, n: stats.min, cls: "text-amber-600 dark:text-amber-400", label: "alt sınır" },
    { Icon: X, n: stats.none, cls: "text-rose-600 dark:text-rose-400", label: "okumadı" },
    { Icon: BookOpen, n: stats.pages, cls: "text-muted-foreground", label: "sayfa" },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {items.map(({ Icon, n, cls, label }) => (
        <span key={label} className={`flex items-center gap-1 font-semibold ${cls}`}>
          <Icon className="size-3.5" /> {n} <span className="font-normal text-muted-foreground">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function RangePicker({ value, onChange, labels = RANGE_LABELS }: { value: Range; onChange: (r: Range) => void; labels?: Record<Range, string> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-lg px-1 py-0.5 text-sm font-bold hover:bg-muted" aria-haspopup="menu" aria-expanded={open}>
        {labels[value]} <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-lg">
          {(Object.keys(labels) as Range[]).map((r) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={r === value}
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${r === value ? "font-semibold text-primary" : ""}`}
            >
              {labels[r]}
              {r === value && <Check className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function useHistory<T>(url: (r: Range) => string, initial?: T) {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(!initial);
  const skip = useRef(!!initial); // sunucudan gelen ilk veri varsa ilk çekimi atla
  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(url(range), { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);
  return { range, setRange, data, loading };
}
