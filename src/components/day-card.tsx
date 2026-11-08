"use client";

import { BookHeart, BookOpen, Check, CheckCheck, ChevronRight, Clock, Link2, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reportReading } from "@/app/actions";
import type { DayCard as Card } from "@/lib/day";
import { formatClock, formatDayLong } from "@/lib/schedule";
import { AvatarStack } from "./avatar";
import { Countdown } from "./countdown";

const CATS = [
  { key: "read", label: "Okudu", Icon: CheckCheck, tone: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "min", label: "Alt sınır", Icon: Check, tone: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
  { key: "none", label: "Okumadı", Icon: X, tone: "text-rose-700 dark:text-rose-400", bg: "bg-rose-500/10" },
  { key: "pending", label: "Bekleniyor", Icon: Clock, tone: "text-muted-foreground", bg: "bg-muted" },
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
  { key: "read", Icon: CheckCheck, label: "Okudum", on: "bg-emerald-600 text-white border-emerald-600" },
  { key: "min", Icon: Check, label: "Alt sınırı okudum", on: "bg-amber-500 text-white border-amber-500" },
  { key: "none", Icon: X, label: "Okumadım", on: "bg-rose-600 text-white border-rose-600" },
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
                  {b.pages != null && <b className="text-foreground"> · {b.pages} sf</b>}
                </p>
                {b.linked?.length ? (
                  <p className="flex items-center gap-0.5 truncate text-[10px] font-semibold leading-tight text-sky-700 dark:text-sky-400" title="Burada işaretlediğin sayfa o gruplara da yansır (orada hedef kadar)">
                    <Link2 className="size-3 shrink-0" /> {b.linked.join(", ")} ile ortak
                  </p>
                ) : null}
              </div>
              <div className="flex gap-1">
                {BOOK_BTNS.map(({ key, Icon, label, on }) => (
                  <button
                    key={key}
                    title={label}
                    aria-label={`${b.title}: ${label}`}
                    aria-pressed={st === key}
                    disabled={pending}
                    onClick={() => send({ bookId: b.id, bookChoice: key }, `${b.id}-${key}`)}
                    className={`flex size-7 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${st === key ? on : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {busy === `${b.id}-${key}` ? <Spinner /> : <Icon className="size-3.5" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {/* Kısa etiketli seçim grubu; ayrıntılar altındaki yardım satırında */}
      <div className="flex gap-1 pt-1" role="group" aria-label="Bugünkü okumanı bildir">
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
          />
        )}
        <ChoiceButton
          className="btn-success"
          on={active === "all"}
          busy={busy === "all"}
          disabled={pending}
          Icon={CheckCheck}
          label="Okudum"
          corner={`${me.target} sf`}
          cornerTone="text-emerald-700 ring-emerald-600/70 dark:text-emerald-300"
          hint={`Hedefin tamamı: ${me.target} sayfa, ceza yok`}
          onClick={() => send({ choice: "all" }, "all")}
        />
        <ChoiceButton
          className="btn-primary"
          on={active === "min"}
          busy={busy === "min"}
          disabled={pending}
          Icon={Check}
          label="Alt sınır"
          corner={me.fine.min ? `${me.min} sf · ${me.fine.min} TL` : `${me.min} sf`}
          cornerTone="text-primary ring-primary/60"
          hint={`Alt sınır: ${me.min} sayfa${me.fine.min ? `, ${me.fine.min} TL ceza` : ""}`}
          onClick={() => send({ choice: "min" }, "min")}
        />
        <ChoiceButton
          className={`btn-ghost ${active === "none" ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400" : ""}`}
          on={active === "none"}
          busy={busy === "none"}
          disabled={pending}
          Icon={X}
          label="Okumadım"
          corner={`${me.fine.none} TL`}
          cornerTone="text-rose-700 ring-rose-500/60 dark:text-rose-300"
          hint={`Okumadım: ${me.fine.none} TL ceza`}
          onClick={() => send({ choice: "none" }, "none")}
        />
      </div>
      {plan && <KefaretOffer plan={plan} today={card.dayKey} dailyPages={me.target + plan.dailyExtra} />}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const shortDay = (k: string) => `${Number(k.slice(8))} ${MONTHS_SHORT[Number(k.slice(5, 7)) - 1]}`;
const addDay = (k: string, n: number) => new Date(Date.parse(k) + n * 86_400_000).toISOString().slice(0, 10);

/** Yöneticinin kefaret teklifi: süre, silinecek tutar, gün başı indirim ve hangi günler kefaret yapıldığı */
function KefaretOffer({ plan, today, dailyPages }: { plan: NonNullable<NonNullable<Card["me"]>["plan"]>; today: string; dailyPages: number }) {
  const perDay = Math.round(plan.discountTotal / plan.days);
  const used = new Set(plan.usedDays ?? []);
  // Başlangıçtan bugüne günler (en fazla son 14)
  const all: string[] = [];
  for (let k = plan.startDay; k <= today && all.length < 400; k = addDay(k, 1)) all.push(k);
  const shown = all.slice(-14);
  const hidden = all.length - shown.length;
  const stats = [
    { v: `${plan.days} gün`, l: "süre" },
    { v: `${plan.discountTotal} TL`, l: "silinecek" },
    { v: `${perDay} TL`, l: "gün başı" },
    { v: `${dailyPages} sf`, l: "günlük" },
  ];
  return (
    <div className="space-y-1.5 rounded-md border border-teal-600/25 bg-teal-500/5 p-2">
      <div className="flex items-center gap-1 text-[10.5px] font-semibold text-teal-700 dark:text-teal-400">
        <BookHeart className="size-3.5 shrink-0" />
        <span className="flex-1">Kefaret teklifi · cezana %{plan.discountPercent} indirim</span>
        <span className="tabular-nums">
          {plan.doneDays}/{plan.days} gün
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        {stats.map((x) => (
          <div key={x.l} className="rounded bg-card px-1 py-0.5">
            <p className="text-[11px] font-bold leading-tight">{x.v}</p>
            <p className="text-[9px] leading-tight text-muted-foreground">{x.l}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 gap-[3px]" aria-label="Kefaret yapılan günler">
          {hidden > 0 && <span className="text-[9px] leading-3 text-muted-foreground">+{hidden}</span>}
          {shown.map((k) => (
            <span
              key={k}
              title={`${shortDay(k)} · ${used.has(k) ? "kefaret okundu" : k === today ? "bugün" : "kefaret yok"}`}
              className={`h-3 flex-1 rounded-[3px] ${used.has(k) ? "bg-teal-600" : "bg-muted"} ${k === today ? "ring-1 ring-teal-600" : ""}`}
            />
          ))}
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          silinen <b className="text-teal-700 dark:text-teal-400">{plan.earned} TL</b>
        </span>
      </div>
      <p className="text-[9.5px] leading-tight text-muted-foreground">
        {shortDay(plan.startDay)}&apos;den beri {used.size} gün kefaret · kalan {Math.max(0, plan.discountTotal - plan.earned)} TL · gün kapanınca borçtan düşer
      </p>
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
  hint,
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
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`btn relative h-7 min-w-0 flex-auto gap-0.5 whitespace-nowrap rounded-md px-1.5 text-[10px] font-semibold [&_svg]:size-3 ${className} ${ring(on)}`}
      aria-pressed={on}
      aria-label={hint}
      title={on ? `${hint} · tekrar bas: geri al` : hint}
      disabled={disabled}
      onClick={onClick}
    >
      {/* Sağ üst çentik: sayfa / ceza; köşe yuvarlaklığı butonla aynı */}
      {corner && <span className={`absolute -right-0.5 -top-1.5 rounded-md bg-card px-[3px] text-[7.5px] font-bold leading-[10px] ring-1 ${cornerTone ?? ""}`}>{corner}</span>}
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
const ring = (on: boolean) => (on ? "ring-2 ring-offset-1 ring-offset-card ring-foreground/40" : "");

function Spinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

/** Okuyanların oranı: büyük bar + kısa sayı (ayrıntı üzerine gelince) */
function DayProgress({ card }: { card: Card }) {
  const total = card.read.length + card.min.length + card.none.length + card.pending.length;
  const done = card.read.length + card.min.length;
  if (!total) return null;
  return (
    <div
      className="flex items-center gap-2"
      title={`${card.read.length} okudu · ${card.min.length} alt sınır · ${card.none.length} okumadı · ${card.pending.length} bekleniyor`}
    >
      <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="bg-emerald-500" style={{ width: `${(card.read.length / total) * 100}%` }} />
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
function CategoryChips({ card, interactive }: { card: Card; interactive?: boolean }) {
  const [open, setOpen] = useState<(typeof CATS)[number]["key"] | null>(null);
  const cats = CATS.filter((c) => card[c.key].length);
  if (!cats.length) return null;
  const sel = CATS.find((c) => c.key === open && card[c.key].length);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {cats.map(({ key, label, Icon, tone, bg }) => {
          const people = card[key];
          const body = (
            <>
              <AvatarStack people={people} size={20} max={3} />
              <span className={`flex items-center gap-0.5 text-[11px] font-bold ${tone}`}>
                <Icon className="size-3.5" strokeWidth={2.5} />
                {interactive && <span className="font-semibold">{label}</span>}
                {people.length}
              </span>
            </>
          );
          return interactive ? (
            <button
              key={key}
              onClick={() => setOpen((o) => (o === key ? null : key))}
              aria-expanded={open === key}
              className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 transition-colors ${bg} ${open === key ? "ring-1 ring-inset ring-current " + tone : "hover:brightness-95"}`}
            >
              {body}
            </button>
          ) : (
            <span key={key} title={label} className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 ${bg}`}>
              {body}
            </span>
          );
        })}
      </div>
      {sel && (
        <div className={`flex flex-wrap gap-1 rounded-lg p-1.5 ${sel.bg}`}>
          {card[sel.key].map((p) => (
            <span key={p.id} className={`inline-flex items-center gap-1 rounded-full bg-card/70 px-2 py-0.5 text-[11px] font-semibold ${sel.tone}`}>
              {p.name}
              {p.kefaret ? <BookHeart className="size-3 text-teal-600 dark:text-teal-400" aria-label="Kefaret okuması" /> : null}
              {p.pages != null && p.pages > 0 && <span className="opacity-70">· {p.pages}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sohbetin ortasında duran gün kartı */
export function DayCardFull({ card, groupId, onReported }: { card: Card; groupId: string; onReported?: () => void }) {
  return (
    <div id={`gun-${card.dayKey}`} className="relative mx-auto w-full max-w-md scroll-mt-24 space-y-2.5 rounded-2xl border border-border bg-card p-3 pt-3.5 shadow-sm">
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
  const myState = me?.pages == null ? null : me.pages >= me.target ? "read" : me.pages >= me.min && me.pages > 0 ? "min" : "none";

  function send(choice: Choice) {
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

  const btns: { key: Choice; state: string; label: string; Icon: typeof Check; on: string }[] = [
    { key: "all", state: "read", label: "Okudum", Icon: CheckCheck, on: "bg-emerald-600 text-white border-emerald-600" },
    { key: "min", state: "min", label: "Alt sınır", Icon: Check, on: "bg-amber-500 text-white border-amber-500" },
    { key: "none", state: "none", label: "Okumadım", Icon: X, on: "bg-rose-600 text-white border-rose-600" },
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
        <div className="flex shrink-0 gap-1">
          {btns.map(({ key, state, label, Icon, on }) => (
            <button
              key={key}
              disabled={pending}
              onClick={() => send(key)}
              aria-pressed={myState === state}
              title={label}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors disabled:opacity-60 ${myState === state ? on : "border-border bg-card hover:bg-muted"}`}
            >
              {busy === key ? <Spinner /> : <Icon className="size-3.5" strokeWidth={2.5} />}
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
