"use client";

import { EdgeNotches } from "./edge-notches";
import { CELL_FRAME, type Tier } from "./tier";

import { BookHeart, BookOpen, Check, CheckCheck, ChevronDown, Clock, Flame, X } from "lucide-react";
import { formatMinutes } from "@/lib/rules";
import { useEffect, useRef, useState } from "react";

export type Range = "7d" | "1m" | "3m" | "1y" | "all";
export const RANGE_LABELS: Record<Range, string> = { "7d": "Son 7 gün", "1m": "Son 1 ay", "3m": "Son 3 ay", "1y": "Son 1 yıl", all: "Üye olduğumdan beri" };
export type Stats = { read: number; min: number; none: number; pages: number; minutes?: number };

const COLOR: Record<string, string> = {
  r: "bg-emerald-500",
  k: "bg-teal-600", // kefaret okuması (maviye çalan yeşil)
  m: "bg-amber-500",
  n: "bg-rose-500",
  p: "bg-transparent ring-1 ring-inset ring-muted-foreground/40",
  "-": "bg-muted",
  x: "bg-muted/40", // aralık dışı (takvimi tamamlayan) günler
};
const TEXT: Record<string, string> = { k: "text-white", r: "text-white", m: "text-white", n: "text-white", p: "text-muted-foreground", "-": "text-muted-foreground/70", x: "text-muted-foreground/40" };
const TITLE: Record<string, string> = { k: "Kefaret okuması", r: "Okudu", m: "Alt sınır", n: "Okumadı", p: "Bekleniyor", "-": "Üye değildi", x: "Aralık dışı" };
const DOW = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
const DOW_MON = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const addDays = (key: string, n: number) => new Date(Date.parse(key) + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (key: string) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

/** Pazartesi başlayan tam haftalara tamamlanmış gün listesi (x: aralık dışı) */
function weeksOf(start: string, cells: string) {
  const lead = (new Date(Date.parse(start)).getUTCDay() + 6) % 7;
  const total = Math.ceil((lead + cells.length) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const key = addDays(start, i - lead);
    const j = i - lead;
    return { key, c: j >= 0 && j < cells.length ? cells[j] : "x", today: j === cells.length - 1 };
  });
}

/** Gün durumları kartın genişliğini boşluksuz doldurur: 7 gün şerit, 1 ay takvim, daha uzun aralık haftalık ısı haritası */
/** frame: ekip çerçevesi (altın / gümüş / bronz) kutucukların çevresinde; gruba özel */
export function HistoryGrid({ start, cells, frame }: { start: string; cells: string; frame?: Tier | null }) {
  const fr = frame ? CELL_FRAME[frame] : "";
  if (cells.length <= 14) {
    return (
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {[...cells].map((c, i) => {
          const key = addDays(start, i);
          const today = i === cells.length - 1;
          return (
            <div key={key} className="flex flex-col items-center gap-0.5" title={`${fmt(key)} · ${TITLE[c]}`}>
              <span className={`text-[10px] font-semibold leading-none ${today ? "text-primary" : "text-muted-foreground"}`}>{DOW[new Date(Date.parse(key)).getUTCDay()]}</span>
              <span className={`relative flex h-7 w-full items-center justify-center rounded-md ${COLOR[c]} ${c !== "-" ? fr : ""} ${today ? "outline-2 outline-offset-1 outline-primary/60" : ""}`}>
                {c === "r" && <CheckCheck className="size-3.5 text-white" strokeWidth={3} />}
                {c === "k" && <BookHeart className="size-3.5 text-white" strokeWidth={2.5} />}
                {c === "m" && <Check className="size-3.5 text-white" strokeWidth={3} />}
                {c === "n" && <X className="size-3.5 text-white" strokeWidth={3} />}
                {frame && c !== "-" && <EdgeNotches tier={frame} offset={0.375} />}
              </span>
              <span className="text-[10px] leading-none text-muted-foreground">{Number(key.slice(8))}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const days = weeksOf(start, cells);
  const weeks = days.length / 7;

  // ~1 ay: haftalar satır, günler sütun (takvim); kutular kart genişliğine yayılır
  if (weeks <= 6) {
    return (
      <div className="grid grid-cols-7 gap-1">
        {DOW_MON.map((d) => (
          <span key={d} className="text-center text-[10px] font-semibold leading-none text-muted-foreground">
            {d}
          </span>
        ))}
        {days.map(({ key, c, today }) => (
          <span
            key={key}
            title={`${fmt(key)} · ${TITLE[c]}`}
            className={`relative flex h-6 items-center justify-center rounded-md text-[11px] font-semibold ${COLOR[c]} ${TEXT[c]} ${c !== "-" && c !== "x" ? fr : ""} ${today ? "outline-2 outline-offset-1 outline-primary/60" : ""}`}
          >
            {Number(key.slice(8))}
            {frame && c !== "-" && c !== "x" && <EdgeNotches tier={frame} offset={0.375} />}
          </span>
        ))}
      </div>
    );
  }

  // Uzun aralık: haftalar sütun × günler satır; sütunlar kartı doldurur, çok uzunsa yatay kaydırılır
  const months = Array.from({ length: weeks }, (_, w) => {
    const first = days.slice(w * 7, w * 7 + 7).find((d) => d.key.endsWith("-01") || (w === 0 && d.c !== "x"));
    return first ? MONTHS[Number(first.key.slice(5, 7)) - 1] : "";
  });
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        className="grid grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "auto repeat(7, auto)", gridTemplateColumns: `auto repeat(${weeks}, minmax(10px, 1fr))`, minWidth: weeks * 13 + 24 }}
      >
        <span />
        {DOW_MON.map((d, i) => (
          <span key={d} className="pr-1 text-[9px] leading-none text-muted-foreground self-center">
            {i % 2 === 0 ? d : ""}
          </span>
        ))}
        {Array.from({ length: weeks }, (_, w) => [
          <span key={`m${w}`} className="h-3 overflow-visible whitespace-nowrap text-[9px] leading-none text-muted-foreground">
            {months[w]}
          </span>,
          ...days.slice(w * 7, w * 7 + 7).map(({ key, c, today }) => (
            <span key={key} title={`${fmt(key)} · ${TITLE[c]}`} className={`aspect-square max-h-5 w-full rounded-[3px] ${COLOR[c]} ${frame && c !== "-" && c !== "x" ? { gold: "ring-[0.5px] ring-[#d4a017]", silver: "ring-[0.5px] ring-[#d0d8e1]", bronze: "ring-[0.5px] ring-[#b07040]/70" }[frame] : ""} ${today ? "outline-2 outline-offset-1 outline-primary/60" : ""}`} />
          )),
        ])}
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
    // Sayfa ve (saat hesabıyla okuyanlarda) süre; yalnızca saat hesabıyla okuyanda sayfa gösterilmez
    ...(stats.pages || !stats.minutes ? [{ Icon: BookOpen, n: stats.pages as number | string, cls: "text-muted-foreground", label: "sayfa" }] : []),
    ...(stats.minutes ? [{ Icon: Clock, n: formatMinutes(stats.minutes), cls: "text-muted-foreground", label: "süre" }] : []),
  ];
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px]">
      {items.map(({ Icon, n, cls, label }) => (
        <span key={label} className={`flex items-center gap-0.5 font-semibold ${cls}`} title={label}>
          <Icon className="size-3.5" /> {n} <span className="font-normal text-muted-foreground">{label}</span>
        </span>
      ))}
    </div>
  );
}

/** Seri en az 3 günden başlar */
export const STREAK_MIN = 3;

/**
 * Okuma serisi rozeti (3 gün ve üstü). Tam seri (üst üste hedef) yeşil, alt sınır dahil seri turuncu.
 * sticker: kartın sağ üst kenarına hafif eğik yapışık durur (kart relative olmalı).
 */
export function StreakBadge({ n, full, size = "sm", sticker }: { n: number; full?: boolean; size?: "sm" | "xs"; sticker?: boolean }) {
  if (n < STREAK_MIN) return null;
  return (
    <span
      title={full ? "Üst üste hedefi tam okunan gün sayısı" : "Üst üste okunan (alt sınır dahil) gün sayısı"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-bold ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]"} ${
        full
          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
      } ${sticker ? "absolute -top-2.5 right-3 z-10 rotate-[5deg] shadow-sm" : ""}`}
    >
      <Flame className={size === "sm" ? "size-3.5" : "size-3"} fill="currentColor" />
      {n} gün {full ? "tam seri" : "seri"}
    </span>
  );
}

/** İsmin yanında küçük seri işareti (sohbet ve üye listesi) */
export function StreakChip({ s }: { s?: { n: number; full: boolean } | null }) {
  if (!s || s.n < STREAK_MIN) return null;
  return (
    <span
      title={s.full ? `${s.n} gün tam seri` : `${s.n} gün seri`}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1 text-[9px] font-bold ${
        s.full ? "border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "border-orange-300/60 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
      }`}
    >
      <Flame className="size-2.5" fill="currentColor" />
      {s.n}
    </span>
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
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);
  return { range, setRange, data, loading };
}

/** Açılır seçim menüsü (grup seçimi vb.) */
export function MenuPicker<T extends string>({ value, options, onChange, icon }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative min-w-0">
      <button onClick={() => setOpen((o) => !o)} className="flex max-w-full items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-semibold hover:bg-muted/70" aria-haspopup="menu" aria-expanded={open}>
        {icon}
        <span className="truncate">{current?.label}</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${o.value === value ? "font-semibold text-primary" : ""}`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="size-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
