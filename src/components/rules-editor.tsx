"use client";

import { BookOpen, CalendarX2, Check, CheckCheck, FileMinus2, Minus, Percent, Plus, X } from "lucide-react";
import { penaltyFor, type Rules } from "@/lib/rules";

export function Tiles<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; Icon: typeof Check; title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(({ value: v, Icon, title, desc }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={`relative rounded-xl border-2 p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}
          >
            {active && (
              <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
            <Icon className={`mb-2 size-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ label, hint, value, onChange, min, max, step = 1, unit, presets }: { label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit: string; presets: number[] }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost size-11 shrink-0 p-0" onClick={() => onChange(clamp(value - step))} aria-label="Azalt">
          <Minus />
        </button>
        <div className="flex h-11 flex-1 items-baseline justify-center gap-1.5 rounded-lg border border-input bg-card">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="w-20 bg-transparent pt-1.5 text-center text-2xl font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        <button type="button" className="btn-ghost size-11 shrink-0 p-0" onClick={() => onChange(clamp(value + step))} aria-label="Artır">
          <Plus />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...new Set(presets.map(clamp))].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${p === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
          >
            {p}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-9">
      <span className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <p className="mb-2 text-sm font-bold">{title}</p>
      {children}
    </div>
  );
}

/** Okuma kurallarını adım adım belirler; altta canlı ceza örneği gösterir */
export function RulesEditor({ value, onChange }: { value: Rules; onChange: (r: Rules) => void }) {
  const set = (patch: Partial<Rules>) => {
    const next = { ...value, ...patch };
    if (next.minPages > next.targetPages) next.minPages = next.targetPages;
    onChange(next);
  };
  const fixed = value.penaltyMode === "FIXED";
  const t = value.targetPages;
  const outcomes = [
    { Icon: CheckCheck, tone: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10", label: `Hedefi okudu (${t}+ sayfa)`, pay: 0 },
    { Icon: Check, tone: "text-amber-700 dark:text-amber-400 bg-amber-500/10", label: `Alt sınırı okudu (${value.minPages} sayfa)`, pay: penaltyFor(value, value.minPages) },
    { Icon: X, tone: "text-rose-700 dark:text-rose-400 bg-rose-500/10", label: "Hiç okumadı", pay: penaltyFor(value, 0) },
  ];

  return (
    <div className="space-y-6">
      <Step n={1} title="Ceza türü">
        <Tiles
          value={value.penaltyMode}
          onChange={(penaltyMode) => set({ penaltyMode })}
          options={[
            { value: "FIXED", Icon: CalendarX2, title: "Günlük ceza", desc: "Hedef tutmazsa günlük sabit tutar" },
            { value: "PER_PAGE", Icon: FileMinus2, title: "Eksik sayfa başına", desc: "Hedefe kalan her sayfa için" },
          ]}
        />
      </Step>

      <Step n={2} title="Günlük okuma hedefi">
        <Stepper label="Her gün okunacak sayfa" value={t} onChange={(targetPages) => set({ targetPages })} min={1} max={2000} unit="sayfa" presets={[10, 20, 30, 50, 100]} />
      </Step>

      <Step n={3} title="Alt sınır">
        <Stepper
          label="Hedefe ulaşamayanın en az okuması gereken"
          hint={fixed ? "Alt sınırı okuyan indirimli ceza öder; altında kalan tam ceza öder." : "“Alt sınırı okudum” butonu bu sayıyı bildirir."}
          value={value.minPages}
          onChange={(minPages) => set({ minPages })}
          min={0}
          max={t}
          unit="sayfa"
          presets={[Math.round(t * 0.25), Math.round(t * 0.5), Math.round(t * 0.75)]}
        />
      </Step>

      <Step n={4} title={fixed ? "Günlük ceza" : "Eksik sayfa başına ceza"}>
        <Stepper
          label={fixed ? "Hedefi tutmayan öder" : "Hedefe eksik kalan her sayfa için"}
          value={value.penaltyAmount}
          onChange={(penaltyAmount) => set({ penaltyAmount })}
          min={0}
          max={100000}
          step={fixed ? 5 : 1}
          unit="TL"
          presets={fixed ? [10, 20, 50, 100] : [1, 2, 5, 10]}
        />
      </Step>

      {fixed && (
        <Step n={5} title="Alt sınırı okuyana indirim">
          <div className="flex items-center gap-3">
            <Percent className="size-5 shrink-0 text-primary" />
            <input type="range" min={0} max={100} step={5} value={value.minDiscount} onChange={(e) => set({ minDiscount: Number(e.target.value) })} className="flex-1 accent-primary" />
            <span className="w-12 text-right text-lg font-bold">%{value.minDiscount}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0, 25, 50, 75].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set({ minDiscount: d })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${d === value.minDiscount ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
              >
                {d === 0 ? "İndirim yok" : `%${d}`}
              </button>
            ))}
          </div>
        </Step>
      )}

      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <BookOpen className="size-3.5" /> Bir günde kim ne öder?
        </p>
        <ul className="space-y-1.5">
          {outcomes.map(({ Icon, tone, label, pay }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-4" />
              </span>
              <span className="flex-1">{label}</span>
              <b className={pay ? "text-destructive" : "text-emerald-600"}>{pay ? `${pay} TL` : "Ceza yok"}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
