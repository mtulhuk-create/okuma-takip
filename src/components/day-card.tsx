"use client";

import { BookHeart, BookOpen, Check, Flame, CheckCheck, ChevronRight, Clock, Link2, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { reportReading } from "@/app/actions";
import type { DayCard as Card } from "@/lib/day";
import { formatClock, formatDayLong } from "@/lib/schedule";
import { AvatarStack } from "./avatar";
import { TIER_COLOR } from "./tier";
import { Countdown } from "./countdown";

const CATS = [
  { key: "kefaret", label: "Kefaret", Icon: BookHeart, tone: "text-teal-700 dark:text-teal-400", bg: "bg-teal-500/10" },
  { key: "read", label: "Okudu", Icon: CheckCheck, tone: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "min", label: "Alt sınır", Icon: Check, tone: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
  { key: "none", label: "Okumadı", Icon: X, tone: "text-rose-700 dark:text-rose-400", bg: "bg-rose-500/10" },
  { key: "pending", label: "Bekleniyor", Icon: Clock, tone: "text-muted-foreground", bg: "bg-muted" },
] as const;
type CatKey = (typeof CATS)[number]["key"];
/** Gün kartında ayrıntı kapalıysa (grup ayarı): yalnızca bildirdi / bildirmedi */
const SIMPLE_CATS = [
  { key: "read", label: "Bildirdi", Icon: Check, tone: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "pending", label: "Bildirmedi", Icon: Clock, tone: "text-muted-foreground", bg: "bg-muted" },
] as const;

type Choice = "all" | "min" | "none";
type BookChoice = "read" | "min" | "none";

function bookState(b: { pages: number | null; target: number; min: number }): BookChoice | "partial" | null {
  if (b.pages == null) return null;
  if (b.pages >= b.target) return "read";
  if (b.pages === 0) return "none";
  if (b.pages >= b.min) return "min";
  return "partial";
}

const BOOK_BTNS: { key: BookChoice; Icon: typeof Check; label: string; on: string }[] = [
  { key: "read", Icon: CheckCheck, label: "Okudum", on: "bg-emerald-500 text-white border-emerald-500" },
  { key: "min", Icon: Check, label: "Alt sınırı okudum", on: "bg-amber-500 text-white border-amber-500" },
  { key: "none", Icon: X, label: "Okumadım", on: "bg-rose-500 text-white border-rose-500" },
];

/** Eser satırları + tümü için butonlar; hem sohbet kartında hem Bugün kartında kullanılır. */
function ReportControls({ groupId, card, onDone, compact }: { groupId: string; card: Card; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = card.me!;

  function send(fields: Record<string, string>, key: string) {
    setBusy(key);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      // Aynı butona tekrar basılırsa sunucu bildirimi geri alır (beklemeye döner)
      fd.set("toggle", "1");
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await reportReading(null, fd);
      setBusy(null);
      if (res?.error) return setError(res.error);
      onDone ? onDone() : router.refresh();
    });
  }

  const active = me.kefaret > 0 ? "kefaret" : wholeChoice(me.books);
  const plan = me.plan;
  // Kefaret okumasında her esere düşen sayfa (sunucudaki dağıtımla aynı: hedefleri oranında)
  const kefPages = new Map<string, number>();
  if (plan) {
    const sum = me.books.reduce((n, b) => n + b.target, 0) || 1;
    let left = plan.dailyExtra;
    me.books.forEach((b, i) => {
      const share = i === me.books.length - 1 ? left : Math.min(left, Math.floor((plan.dailyExtra * b.target) / sum));
      left -= share;
      kefPages.set(b.id, b.target + share);
    });
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"} onClick={(e) => e.stopPropagation()}>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {me.books.map((b) => {
          const st = bookState(b);
          return (
            <li key={b.id} className="flex items-center gap-2 px-2.5 py-1.5">
              <BookOpen className="size-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-snug">{b.title}</p>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  Hedef {b.target} · alt sınır {b.min}
                  {plan && <span className="text-teal-700 dark:text-teal-400"> · kefaret {kefPages.get(b.id)}</span>}
                  {b.pages != null && <b className="text-foreground"> · {b.pages} sf</b>}
                </p>
                {b.linked?.length ? (
                  <p className="flex items-center gap-0.5 truncate text-[10px] font-semibold leading-tight text-sky-700 dark:text-sky-400" title="Burada işaretlediğin sayfa o gruplara da yansır (orada hedef kadar)">
                    <Link2 className="size-3 shrink-0" /> {b.linked.join(", ")} ile ortak
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {plan && (
                  <button
                    title={`Kefaret okuması: bugün toplam ${me.target + plan.dailyExtra} sayfa`}
                    aria-label={`${b.title}: kefaret okuması`}
                    aria-pressed={active === "kefaret"}
                    disabled={pending}
                    onClick={() => send({ choice: "kefaret" }, `${b.id}-kefaret`)}
                    className={`flex size-7 items-center justify-center rounded-md border disabled:opacity-60 ${press} ${active === "kefaret" ? "border-teal-600 bg-teal-600 text-white" : "border-teal-600/40 text-teal-700 hover:bg-teal-500/10 dark:text-teal-400"}`}
                  >
                    {busy === `${b.id}-kefaret` ? <Spinner /> : <BookHeart className="size-3.5" strokeWidth={2.5} />}
                  </button>
                )}
                {BOOK_BTNS.map(({ key, Icon, label, on }) => (
                  <button
                    key={key}
                    title={label}
                    aria-label={`${b.title}: ${label}`}
                    aria-pressed={st === key}
                    disabled={pending}
                    onClick={() => send({ bookId: b.id, bookChoice: key }, `${b.id}-${key}`)}
                    className={`flex size-7 items-center justify-center rounded-md border disabled:opacity-60 ${press} ${st === key ? on : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {busy === `${b.id}-${key}` ? <Spinner /> : <Icon className="size-3.5" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {plan && <KefaretOffer plan={plan} today={card.dayKey} dailyPages={me.target + plan.dailyExtra} markedToday={me.kefaret > 0} />}
      {/* Kısa etiketli seçim grubu; sayfa / ceza sağ üst çentiklerde */}
      <div className="flex gap-2.5 px-1.5 pb-1.5 pt-1" role="group" aria-label="Bugünkü okumanı bildir">
        {plan && (
          <ChoiceButton
            className="bg-teal-600 text-white hover:bg-teal-700"
            on={active === "kefaret"}
            busy={busy === "kefaret"}
            disabled={pending}
            Icon={BookHeart}
            label="Kefaret"
            corner={`${me.target + plan.dailyExtra} sf`}
            cornerTone="text-teal-700 ring-teal-600/70 dark:text-teal-300"
            hint={`Kefaret okuması: bugün toplam ${me.target + plan.dailyExtra} sayfa, ≈${Math.round(plan.discountTotal / plan.days)} TL indirim`}
            onClick={() => send({ choice: "kefaret" }, "kefaret")}
            dense
          />
        )}
        <ChoiceButton
          className="bg-emerald-500 text-white hover:bg-emerald-600"
          on={active === "all"}
          busy={busy === "all"}
          disabled={pending}
          Icon={CheckCheck}
          dense={!!plan}
          label="Okudum"
          corner={`${me.target} sf`}
          cornerTone="text-emerald-700 ring-emerald-600/70 dark:text-emerald-300"
          hint={`Hedefin tamamı: ${me.target} sayfa, ceza yok`}
          onClick={() => send({ choice: "all" }, "all")}
        />
        <ChoiceButton
          className="bg-amber-500 text-white hover:bg-amber-600"
          on={active === "min"}
          busy={busy === "min"}
          disabled={pending}
          Icon={Check}
          dense={!!plan}
          label="Alt sınır"
          corner={`${me.min} sf`}
          cornerTone="text-amber-700 ring-amber-500/70 dark:text-amber-300"
          fine={me.fine.min ? `-${me.fine.min} TL` : undefined}
          hint={`Alt sınır: ${me.min} sayfa${me.fine.min ? `, ${me.fine.min} TL ceza` : ""}`}
          onClick={() => send({ choice: "min" }, "min")}
        />
        <ChoiceButton
          className="bg-rose-500 text-white hover:bg-rose-600"
          on={active === "none"}
          busy={busy === "none"}
          disabled={pending}
          Icon={X}
          dense={!!plan}
          label="Okumadım"
          fine={`-${me.fine.none} TL`}
          hint={`Okumadım: ${me.fine.none} TL ceza`}
          onClick={() => send({ choice: "none" }, "none")}
        />
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const shortDay = (k: string) => `${Number(k.slice(8))} ${MONTHS_SHORT[Number(k.slice(5, 7)) - 1]}`;
const addDay = (k: string, n: number) => new Date(Date.parse(k) + n * 86_400_000).toISOString().slice(0, 10);

/** Yöneticinin kefaret teklifi: kaç gün, ne kadar silinecek, ne kadarı silindi ve son günlerde kefaret yapılıp yapılmadığı */
function KefaretOffer({ plan, today, dailyPages, markedToday }: { plan: NonNullable<NonNullable<Card["me"]>["plan"]>; today: string; dailyPages: number; markedToday: boolean }) {
  const perDay = Math.round(plan.discountTotal / plan.days);
  const used = new Set(plan.usedDays ?? []);
  if (markedToday) used.add(today);
  const pct = plan.discountTotal ? Math.min(100, Math.round((plan.earned / plan.discountTotal) * 100)) : 0;
  // Bugün kefaret okunduysa: payı gün kapanınca düşer, o zamana kadar "bekliyor" olarak görünür
  const pendingPct = markedToday && plan.discountTotal ? Math.min(100 - pct, Math.round((perDay / plan.discountTotal) * 100)) : 0;
  // Son 7 gün (başlangıçtan önceki günler gösterilmez)
  const recent: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDay(today, -i);
    if (k >= plan.startDay) recent.push(k);
  }
  return (
    <div className="space-y-1 rounded-md bg-teal-500/[0.07] px-2 py-1.5 ring-1 ring-teal-600/20">
      <div className="flex items-center gap-1 text-[10.5px] font-semibold text-teal-700 dark:text-teal-400">
        <BookHeart className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">
          Kefaret teklifi{plan.discountPercent ? ` · %${plan.discountPercent} indirim` : ""}
        </span>
        <span className="tabular-nums">
          {plan.doneDays}
          {markedToday && <span className="opacity-70">+1</span>}/{plan.days} gün
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full bg-teal-600" style={{ width: `${pct}%` }} />
          <span className="block h-full bg-teal-600/40" style={{ width: `${pendingPct}%` }} title="Bugünkü kefaret: gün kapanınca borçtan düşer" />
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          <b className="text-foreground">{plan.earned}</b>/{plan.discountTotal} TL silindi
          {markedToday && <span className="text-teal-700 dark:text-teal-400"> · bugün +{perDay} TL</span>}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">
          Günde <b className="text-foreground">{dailyPages} sf</b> · gün başı <b className="text-foreground">{perDay} TL</b> · kalan {Math.max(0, plan.discountTotal - plan.earned)} TL
        </span>
        <span className="flex shrink-0 gap-[3px]" aria-label="Son günlerde kefaret">
          {recent.map((k) => (
            <span
              key={k}
              title={`${shortDay(k)} · ${used.has(k) ? "kefaret okundu" : k === today ? "bugün" : "kefaret yok"}`}
              className={`size-2 rounded-full ${used.has(k) ? "bg-teal-600" : "bg-muted-foreground/25"} ${k === today ? "ring-1 ring-teal-600 ring-offset-1 ring-offset-card" : ""}`}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

/** Gün kartı butonu: kısa etiket; ayrıntı ipucunda ve yardım satırında. Seçiliyse tekrar basınca geri alınır */
function ChoiceButton({
  className,
  on,
  busy,
  disabled,
  Icon,
  label,
  corner,
  cornerTone,
  fine,
  hint,
  dense,
  onClick,
}: {
  className: string;
  on: boolean;
  busy: boolean;
  disabled: boolean;
  Icon: typeof Check;
  label: string;
  corner?: string;
  cornerTone?: string;
  /** Sağ alt çentik: yazılacak ceza ("-10 TL"); sayfa çentiğiyle asla aynı yerde değil */
  fine?: string;
  hint: string;
  /** 4 buton (kefaret) varken bir tık küçük */
  dense?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`relative inline-flex min-w-0 flex-auto select-none items-center justify-center gap-0.5 whitespace-nowrap rounded-md border-2 font-semibold disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 ${press} ${dense ? "h-6 px-1 text-[9px] [&_svg]:size-2.5" : "h-7 px-1.5 text-[10px] [&_svg]:size-3"} ${className} ${ring(on)}`}
      aria-pressed={on}
      aria-label={hint}
      title={on ? `${hint} · tekrar bas: geri al` : hint}
      disabled={disabled}
      onClick={onClick}
    >
      {/* Sağ üst çentik: sayfa / ceza; köşe yuvarlaklığı butonla aynı */}
      {corner && <span className={`absolute -right-0.5 -top-1.5 rounded-md bg-card px-[3px] text-[7.5px] font-bold leading-[10px] ring-1 ${cornerTone ?? ""}`}>{corner}</span>}
      {fine && <span className="absolute -bottom-1.5 -right-0.5 rounded-md bg-card px-[3px] text-[7.5px] font-bold leading-[10px] text-rose-700 ring-1 ring-rose-500/60 dark:text-rose-300">{fine}</span>}
      {busy ? <Spinner /> : <Icon />}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Tüm eserler için hangi toplu seçim aktif (geri almak için aynı butona basılır) */
function wholeChoice(books: { pages: number | null; target: number; min: number }[]): Choice | null {
  if (!books.length || books.some((b) => b.pages == null)) return null;
  if (books.every((b) => b.pages! >= b.target)) return "all";
  if (books.every((b) => b.pages === 0)) return "none";
  if (books.every((b) => b.pages === b.min)) return "min";
  return null;
}
// Seçili buton belirgin çerçeveli; basınca küçülüp kararır (dokunma geri bildirimi)
// Seçili: dış çerçeve yok; butonun kendi kenar rengi koyulaşır ve içe basık görünür
const ring = (on: boolean) => (on ? "border-black/35 dark:border-white/85 shadow-[inset_0_2px_5px_rgba(0,0,0,0.35)]" : "border-transparent");
// Basınca: yumuşak, tok küçülme + kararma + içe basık gölge
const press =
  "transition-[transform,filter,box-shadow,border-color] duration-150 ease-out active:scale-[0.93] active:brightness-90 active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]";

function Spinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

/** Okuyanların oranı: büyük bar + kısa sayı (ayrıntı üzerine gelince) */
function DayProgress({ card }: { card: Card }) {
  const total = card.read.length + card.min.length + card.none.length + card.pending.length;
  const done = card.read.length + card.min.length;
  const kef = card.read.filter((p) => p.kefaret).length;
  if (!total) return null;
  return (
    <div
      className="flex items-center gap-2"
      title={`${card.read.length} okudu${kef ? ` (${kef} kefaret)` : ""} · ${card.min.length} alt sınır · ${card.none.length} okumadı · ${card.pending.length} bekleniyor`}
    >
      <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        {/* Kefaret okuyanlar ayrı renkte: diğerlerinden fazlasını okudukları belli olsun */}
        <span className="bg-teal-600" style={{ width: `${(kef / total) * 100}%` }} />
        <span className="bg-emerald-500" style={{ width: `${((card.read.length - kef) / total) * 100}%` }} />
        <span className="bg-amber-500" style={{ width: `${(card.min.length / total) * 100}%` }} />
        <span className="bg-rose-500" style={{ width: `${(card.none.length / total) * 100}%` }} />
      </div>
      <span className="shrink-0 text-xs font-bold tabular-nums">
        {done}
        <span className="font-semibold text-muted-foreground">/{total}</span>
      </span>
    </div>
  );
}

/**
 * Günün hasılatı: kasanın o gün alacağı ceza. Kartın üst kenarının ortasında, kenarlığa bitişik küçük çıkıntı.
 * Gün açıkken bildirmeyenler okumadı sayılır (en kötü durum); okudukça düşer.
 */
function RevenueTab({ card }: { card: Card }) {
  if (card.penaltyTotal == null) return null;
  const v = card.penaltyTotal;
  return (
    <span
      title={card.penaltyFinal ? "Bu gün yazılan cezalar" : "Bildirmeyenler okumadı sayılır; okudukça düşer"}
      className="absolute -top-2.5 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold leading-4 text-muted-foreground shadow-xs"
    >
      Günün hasılatı <b className={v ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}>{v} TL</b>
    </span>
  );
}

/** Süre / kapandı göstergesi */
function DeadlinePill({ card, withClock }: { card: Card; withClock?: boolean }) {
  if (!card.open)
    return (
      <span className="badge shrink-0 bg-muted text-muted-foreground">
        <Lock /> Kapandı
      </span>
    );
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className="flex items-center justify-end gap-1 text-xs">
        <Clock className="size-3.5 text-muted-foreground" />
        <Countdown to={card.deadline} className="font-bold" />
      </span>
      {withClock && <span className="block text-[10px] text-muted-foreground">Son bildirim {formatClock(card.deadline)}</span>}
    </span>
  );
}

/** Kategori çipleri: üst üste profil resimleri + sayı; dokununca isimler açılır */
/** Gün kapanmadan önceki son 1 dakika (bildirim süresi) */
function useLastMinute(deadline: string, open: boolean) {
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    if (!open) return;
    const end = Date.parse(deadline);
    const tick = () => {
      const left = end - Date.now();
      setUrgent(left > 0 && left <= 60_000);
    };
    const t0 = setTimeout(tick, 0);
    const t1 = setTimeout(tick, Math.max(0, end - 60_000 - Date.now()));
    const t2 = setTimeout(tick, Math.max(0, end - Date.now() + 50));
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      setUrgent(false);
    };
  }, [deadline, open]);
  return urgent;
}

/** Son dakikada kartın kırmızı kenarı yanıp söner */
function BlinkBorder({ on }: { on: boolean }) {
  if (!on) return null;
  return <span aria-hidden className="border-blink pointer-events-none absolute -inset-px rounded-[inherit] border-2 border-primary" />;
}

const CHIP_AVATAR = 24;

/** Rozete sığan avatar sayısı: yuvayı doldurana kadar avatar, sonra "+N" */
function chipCapacity(slot: number, label: string, count: number, interactive?: boolean) {
  const step = CHIP_AVATAR - 8;
  const text = 16 + (interactive ? label.length * 6.4 + 4 : 0) + String(count).length * 7 + 22;
  return Math.max(1, Math.floor((slot - text - CHIP_AVATAR) / step) + 1);
}

/** Kim okudu rozetleri: satırda en çok 2 rozet, her biri kendi yuvasının ortasında; avatar eklendikçe genişler */
function CategoryChips({ card, interactive }: { card: Card; interactive?: boolean }) {
  const [open, setOpen] = useState<CatKey | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
    // Rozetler sonradan belirirse ölçüm yeniden kurulur
  }, [card.read.length + card.min.length + card.none.length + card.pending.length > 0]);
  const simple = !!(card as { simple?: boolean }).simple;
  // Kefaret okuyanlar "Okudu"dan ayrı, kendi renginde gösterilir
  const lists: Record<CatKey, Card["read"]> = simple
    ? { kefaret: [], read: card.read, min: [], none: [], pending: card.pending }
    : { kefaret: card.read.filter((p) => p.kefaret), read: card.read.filter((p) => !p.kefaret), min: card.min, none: card.none, pending: card.pending };
  const all = simple ? SIMPLE_CATS : CATS;
  const cats = all.filter((c) => lists[c.key].length);
  const sel = cats.find((c) => c.key === open);
  if (!cats.length) return null;
  return (
    <div className="space-y-1.5">
      <div ref={ref} className="grid grid-cols-2 gap-x-1.5 gap-y-1.5">
        {cats.map(({ key, label, Icon, tone, bg }, i) => {
          const people = lists[key];
          // Satırda tek kalan (tek sayıda rozetin sonuncusu) tüm satırı yuva alır
          const alone = cats.length % 2 === 1 && i === cats.length - 1;
          const slot = width ? (alone ? width : (width - 6) / 2) : 0;
          const cap = slot ? chipCapacity(slot, label, people.length, interactive) : 4;
          const max = people.length > cap ? Math.max(1, cap - 1) : people.length;
          const body = (
            <>
              <AvatarStack people={people} size={CHIP_AVATAR} max={max} />
              <span className={`flex shrink-0 items-center gap-0.5 text-[11px] font-bold ${tone}`}>
                <Icon className="size-3.5" strokeWidth={2.5} />
                {interactive && <span className="font-semibold">{label}</span>}
                {people.length}
              </span>
            </>
          );
          const cls = `inline-flex max-w-full items-center gap-1.5 rounded-full py-px pl-0.5 pr-2.5 ${bg}`;
          return (
            <div key={key} className={`flex justify-center ${alone ? "col-span-2" : ""}`}>
              {interactive ? (
                <button onClick={() => setOpen((o) => (o === key ? null : key))} aria-expanded={open === key} className={`${cls} transition-colors ${open === key ? "ring-1 ring-inset ring-current " + tone : "hover:brightness-95"}`}>
                  {body}
                </button>
              ) : (
                <span title={label} className={cls}>
                  {body}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {sel && (
        // İsimler ortadan dizilir; ekip çerçevesi üst kenarda, seri sağ üst köşede alev
        <div className={`flex flex-wrap justify-center gap-x-1 gap-y-2.5 rounded-lg px-1.5 pb-1.5 pt-2.5 ${sel.bg}`}>
          {lists[sel.key].map((p) => (
            // Ekip çerçevesi: yalnızca üst kenar ince ve hafif saydam altın / gümüş / bronz
            <span
              key={p.id}
              className={`relative inline-flex items-center gap-1 rounded-full border border-border bg-card/70 px-2 py-0.5 text-[11px] font-semibold ${sel.tone}`}
              style={p.tier ? { borderTopColor: TIER_COLOR[p.tier] + "cc" } : undefined}
            >
              {p.name}
              {p.kefaret ? <BookHeart className="size-3 text-teal-600 dark:text-teal-400" aria-label="Kefaret okuması" /> : null}
              {p.pages != null && p.pages > 0 && <span className="opacity-70">· {p.pages}</span>}
              {p.streak && p.streak.n >= 3 && (
                <span className="pointer-events-none absolute -right-1.5 -top-2.5 flex size-4 rotate-12 items-center justify-center" title={`${p.streak.n} gün ${p.streak.full ? "tam seri" : "seri"}`}>
                  <Flame className={`absolute size-4 ${p.streak.full ? "text-emerald-500" : "text-orange-500"}`} fill="currentColor" strokeWidth={1.5} />
                  <span className="relative top-[2px] text-[6.5px] font-bold leading-none text-white">{p.streak.n}</span>
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sohbetin ortasında duran gün kartı */
export function DayCardFull({ card, groupId, onReported }: { card: Card; groupId: string; onReported?: () => void }) {
  const urgent = useLastMinute(card.deadline, card.open);
  return (
    <div id={`gun-${card.dayKey}`} className="relative mx-auto w-full max-w-md scroll-mt-24 space-y-2.5 rounded-2xl border border-border bg-card p-3 pt-3.5 shadow-sm">
      <BlinkBorder on={urgent} />
      <RevenueTab card={card} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase leading-tight tracking-wider text-primary">Okuma günü</p>
          <h3 className="truncate font-serif text-[15px] font-bold leading-snug">{formatDayLong(card.dayKey)}</h3>
        </div>
        <DeadlinePill card={card} withClock />
      </div>
      <DayProgress card={card} />
      <CategoryChips card={card} interactive />
      {card.open && card.me && (
        <div className="space-y-1.5 border-t border-border pt-2.5">
          {(card.me.teamName || !card.me.eligible) && (
            <p className="text-[11px] text-muted-foreground">
              {card.me.teamName && <b className="text-foreground">{card.me.teamName} ekibi</b>}
              {card.me.teamName && !card.me.eligible && " · "}
              {!card.me.eligible && "bugün katıldığın için ceza yazılmaz"}
            </p>
          )}
          <ReportControls groupId={groupId} card={card} onDone={onReported} />
        </div>
      )}
    </div>
  );
}

/** Bugün sayfasındaki sade kart; tıklanınca grubun sohbetinde bu güne gider */
export function DayCardMini({ card, groupId, groupName }: { card: Card; groupId: string; groupName: string }) {
  const urgent = useLastMinute(card.deadline, card.open);
  const router = useRouter();
  const href = `/gruplar/${groupId}#gun-${card.dayKey}`;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
      onMouseEnter={() => router.prefetch(href)}
      className="card relative mt-2 cursor-pointer space-y-2.5 p-3 pt-3.5 transition-colors hover:border-primary/40"
    >
      <BlinkBorder on={urgent} />
      <RevenueTab card={card} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-serif text-[15px] font-bold leading-snug">{groupName}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{formatDayLong(card.dayKey)}</p>
        </div>
        <DeadlinePill card={card} />
      </div>
      <DayProgress card={card} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CategoryChips card={card} />
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {card.open && card.me && (
        <>
          {!card.me.eligible && <p className="text-[11px] text-muted-foreground">Bugün katıldığın için ceza yazılmaz</p>}
          <ReportControls groupId={groupId} card={card} compact />
        </>
      )}
    </div>
  );
}

/** Sohbette gün kartı ekranda değilken başlığın altında duran kısayol: temel bilgi + temel butonlar */
export function DayShortcut({ card, groupId, onJump, onReported }: { card: Card; groupId: string; onJump: () => void; onReported?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const total = card.read.length + card.min.length + card.none.length + card.pending.length;
  const done = card.read.length + card.min.length;
  const me = card.me;
  const myState = me?.pages == null ? null : me.kefaret > 0 ? "kefaret" : me.pages >= me.target ? "read" : me.pages >= me.min && me.pages > 0 ? "min" : "none";
  const plan = me?.plan ?? null;

  function send(choice: Choice | "kefaret") {
    setBusy(choice);
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("choice", choice);
      fd.set("toggle", "1");
      await reportReading(null, fd);
      setBusy(null);
      onReported ? onReported() : router.refresh();
    });
  }

  // Gün kartındaki butonlarla aynı: kefaret (varsa) en başta, sağ üst çentikte sayfa / ceza
  const btns: { key: Choice | "kefaret"; state: string; label: string; corner?: string; fine?: string; tone: string; Icon: typeof Check; on: string }[] = [
    ...(plan && me
      ? [{ key: "kefaret" as const, state: "kefaret", label: "Kefaret", corner: `${me.target + plan.dailyExtra} sf`, tone: "text-teal-700 ring-teal-600/70", Icon: BookHeart, on: "bg-teal-600 text-white border-teal-600" }]
      : []),
    { key: "all", state: "read", label: "Okudum", corner: me ? `${me.target} sf` : undefined, tone: "text-emerald-700 ring-emerald-600/70", Icon: CheckCheck, on: "bg-emerald-600 text-white border-emerald-600" },
    { key: "min", state: "min", label: "Alt sınır", corner: me ? `${me.min} sf` : undefined, fine: me?.fine?.min ? `-${me.fine.min} TL` : undefined, tone: "text-amber-700 ring-amber-500/70", Icon: Check, on: "bg-amber-500 text-white border-amber-500" },
    { key: "none", state: "none", label: "Okumadım", fine: me?.fine ? `-${me.fine.none} TL` : undefined, tone: "text-rose-700 ring-rose-500/60", Icon: X, on: "bg-rose-500 text-white border-rose-500" },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-border bg-card/95 px-3 py-1.5 backdrop-blur">
      <button onClick={onJump} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Gün kartına git">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="size-4" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs font-bold">{formatDayLong(card.dayKey)}</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {card.open ? <Countdown to={card.deadline} className="font-semibold" /> : "Kapandı"}
            <span>·</span>
            <span>
              {done}/{total} okudu
            </span>
          </span>
        </span>
      </button>
      {card.open && me ? (
        <div className="flex shrink-0 gap-2 pb-1 pt-1">
          {btns.map(({ key, state, label, corner, fine, tone, Icon, on }) => (
            <button
              key={key}
              disabled={pending}
              onClick={() => send(key)}
              aria-pressed={myState === state}
              title={label}
              className={`relative flex h-7 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold disabled:opacity-60 ${press} ${myState === state ? on : "border-border bg-card hover:bg-muted"}`}
            >
              {corner && <span className={`absolute -right-0.5 -top-1.5 rounded-md bg-card px-[3px] text-[7px] font-bold leading-[9px] ring-1 ${tone}`}>{corner}</span>}
              {fine && <span className="absolute -bottom-1.5 -right-0.5 rounded-md bg-card px-[3px] text-[7px] font-bold leading-[9px] text-rose-700 ring-1 ring-rose-500/60">{fine}</span>}
              {busy === key ? <Spinner /> : <Icon className="size-3" strokeWidth={2.5} />}
              <span className="hidden min-[400px]:inline">{label}</span>
            </button>
          ))}
        </div>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}
