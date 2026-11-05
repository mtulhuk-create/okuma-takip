"use client";

import { BookOpenCheck, Check, CheckCheck, ChevronRight, Clock, Lock, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reportReading } from "@/app/actions";
import type { DayCard as Card, DayPerson } from "@/lib/day";
import { formatClock, formatDayLong } from "@/lib/schedule";
import { AvatarStack } from "./avatar";
import { Countdown } from "./countdown";

const CATS = [
  { key: "read", label: "Okudu", Icon: CheckCheck, tone: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "min", label: "Alt sınır", Icon: Check, tone: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
  { key: "none", label: "Okumadı", Icon: X, tone: "text-rose-700 dark:text-rose-400", bg: "bg-rose-500/10" },
  { key: "pending", label: "Bekleniyor", Icon: Clock, tone: "text-muted-foreground", bg: "bg-muted" },
] as const;

type Choice = "pages" | "min" | "none";

/** Okuma bildirimi butonları; hem sohbet kartında hem Bugün kartında kullanılır. */
function ReportControls({ groupId, card, onDone, compact }: { groupId: string; card: Card; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<Choice | null>(null);
  const [editing, setEditing] = useState(false);
  const [pages, setPages] = useState(String(card.me?.pages ?? card.me?.target ?? ""));
  const [error, setError] = useState<string | null>(null);
  const me = card.me!;

  function send(choice: Choice) {
    setBusy(choice);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("choice", choice);
      if (choice === "pages") fd.set("pages", pages);
      const res = await reportReading(null, fd);
      setBusy(null);
      if (res?.error) return setError(res.error);
      setEditing(false);
      onDone ? onDone() : router.refresh();
    });
  }

  if (me.pages != null && !editing) {
    const ok = me.pages >= me.min;
    return (
      <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${ok ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
          {ok ? <CheckCheck className="size-4" /> : <X className="size-4" />}
          {me.pages} sayfa bildirdin {me.pages >= me.target ? "· hedef tamam" : me.pages >= me.min ? "· alt sınır" : ""}
        </p>
        <button className="btn-quiet btn-sm" onClick={() => setEditing(true)}>
          <Pencil /> Değiştir
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send("pages");
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            autoFocus
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            className="input"
            placeholder="Kaç sayfa okudun?"
          />
          <button className="btn-success" disabled={pending || pages === ""}>
            {busy === "pages" ? <Spinner /> : <Check />} Kaydet
          </button>
          <button type="button" className="btn-icon" onClick={() => setEditing(false)} aria-label="Vazgeç">
            <X />
          </button>
        </form>
      ) : (
        <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
          <button className={`btn-success ${compact ? "btn-sm h-9 px-2" : ""}`} disabled={pending} onClick={() => setEditing(true)}>
            <BookOpenCheck /> Okudum
          </button>
          <button className={`btn-primary ${compact ? "btn-sm h-9 px-2" : ""}`} disabled={pending} onClick={() => send("min")}>
            {busy === "min" ? <Spinner /> : <Check />} {compact ? `Alt sınır (${me.min})` : `Alt sınırı okudum (${me.min})`}
          </button>
          <button className={`btn-ghost ${compact ? "btn-sm h-9 px-2" : ""}`} disabled={pending} onClick={() => send("none")}>
            {busy === "none" ? <Spinner /> : <X />} Okumadım
          </button>
        </div>
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function CategoryRow({ label, Icon, tone, bg, people }: { label: string; Icon: typeof Check; tone: string; bg: string; people: DayPerson[] }) {
  const [open, setOpen] = useState(false);
  if (!people.length) return null;
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/60">
        <span className={`flex size-7 items-center justify-center rounded-full ${bg} ${tone}`}>
          <Icon className="size-4" />
        </span>
        <span className="flex-1 text-sm font-semibold">
          {label} <span className="font-normal text-muted-foreground">· {people.length}</span>
        </span>
        <AvatarStack people={people} size={26} />
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-1">
          {people.map((p) => (
            <span key={p.id} className={`badge ${bg} ${tone}`}>
              {p.name.split(" ")[0]}
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
  const total = card.read.length + card.min.length + card.none.length + card.pending.length;
  const done = card.read.length + card.min.length;
  return (
    <div id={`gun-${card.dayKey}`} className="mx-auto w-full max-w-md scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Okuma günü</p>
          <h3 className="font-serif text-lg font-bold">{formatDayLong(card.dayKey)}</h3>
        </div>
        {card.open ? (
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Son bildirim {formatClock(card.deadline)}</p>
            <Countdown to={card.deadline} className="text-sm font-bold" />
          </div>
        ) : (
          <span className="badge bg-muted text-muted-foreground">
            <Lock /> Kapandı
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mb-3">
          <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="bg-emerald-500" style={{ width: `${(card.read.length / total) * 100}%` }} />
            <span className="bg-amber-500" style={{ width: `${(card.min.length / total) * 100}%` }} />
            <span className="bg-rose-500" style={{ width: `${(card.none.length / total) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {done}/{total} kişi hedefini tuttu
          </p>
        </div>
      )}
      <div className="space-y-0.5">
        {CATS.map(({ key, ...c }) => (
          <CategoryRow key={key} {...c} people={card[key]} />
        ))}
      </div>
      {card.open && card.me && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {card.me.teamName && <b className="text-foreground">{card.me.teamName} · </b>}
            Hedef <b className="text-foreground">{card.me.target}</b> sayfa · alt sınır <b className="text-foreground">{card.me.min}</b>
            {!card.me.eligible && " · bugün katıldığın için ceza yazılmaz"}
          </p>
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
      className="card cursor-pointer space-y-3 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-bold">{groupName}</p>
          <p className="text-xs text-muted-foreground">{formatDayLong(card.dayKey)}</p>
        </div>
        {card.open ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <Countdown to={card.deadline} className="font-semibold" />
          </span>
        ) : (
          <span className="badge bg-muted text-muted-foreground">
            <Lock /> Kapandı
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {CATS.map(({ key, Icon, tone }) =>
          card[key].length ? (
            <span key={key} className="flex items-center gap-1.5">
              <AvatarStack people={card[key]} size={22} max={3} />
              <span className={`flex items-center text-xs font-bold ${tone}`}>
                <Icon className="size-3.5" />
                {card[key].length}
              </span>
            </span>
          ) : null,
        )}
        <ChevronRight className="ml-auto size-4 text-muted-foreground" />
      </div>
      {card.open && card.me && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Hedef {card.me.target} · alt sınır {card.me.min}
            {!card.me.eligible && " · bugün ceza yok"}
          </p>
          <ReportControls groupId={groupId} card={card} compact />
        </>
      )}
    </div>
  );
}
