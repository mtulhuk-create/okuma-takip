"use client";

import { Check, SmilePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteMessage, reactMessage, votePoll } from "@/app/actions";
import type { ChatMessage } from "@/lib/chat";
import { formatClock } from "@/lib/schedule";
import { Avatar } from "../avatar";
import { BadgeChip } from "../badge-chip";
import { StreakFlame } from "../day-card";

const NAME_COLORS = ["text-rose-700", "text-amber-700", "text-emerald-700", "text-sky-700", "text-violet-700", "text-orange-700", "text-teal-700"];
function nameColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${NAME_COLORS[h % NAME_COLORS.length]} dark:brightness-150`;
}

export type UiMessage = ChatMessage & { pending?: boolean; failed?: boolean; progress?: number };

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-icon size-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-60 [&_svg]:size-3.5"
      aria-label="Mesajı sil"
      disabled={pending}
      onClick={() => {
        if (!confirm("Bu mesaj herkes için silinsin mi?")) return;
        start(async () => {
          const fd = new FormData();
          fd.set("messageId", id);
          await deleteMessage(null, fd);
          onDone();
        });
      }}
    >
      <Trash2 />
    </button>
  );
}

/** Mesajlara bırakılabilen ifadeler (sunucudakiyle aynı) */
const REACTIONS = ["👍", "❤️", "🤲", "😂", "😮", "🔥"];
type Reaction = ChatMessage["reactions"][number];

/** Benim ifademi değiştirir: aynısıysa kaldırır, farklıysa yerine koyar (anında görünsün diye) */
function toggleReaction(list: Reaction[], emoji: string): Reaction[] {
  const had = list.find((r) => r.mine)?.emoji;
  let out = list.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false, names: r.names.filter((n) => n !== "Sen") } : r)).filter((r) => r.count > 0);
  if (had !== emoji) {
    const hit = out.find((r) => r.emoji === emoji);
    out = hit ? out.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true, names: [...r.names, "Sen"] } : r)) : [...out, { emoji, count: 1, mine: true, names: ["Sen"] }];
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Metin ve anket mesajları için balon çerçevesi (grubun ilk mesajında kuyruklu) */
export function Bubble({
  m,
  mine,
  showAuthor,
  canDelete,
  onChanged,
  children,
}: {
  m: UiMessage;
  mine: boolean;
  showAuthor: boolean;
  canDelete: boolean;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const [picker, setPicker] = useState(false);
  const [, start] = useTransition();
  // Sunucudan yeni veri gelene kadar benim ifadem anında görünür
  const [over, setOver] = useState<{ base: Reaction[] | undefined; value: Reaction[] } | null>(null);
  const reactions = over && over.base === m.reactions ? over.value : (m.reactions ?? []);
  const canReact = !m.pending && !m.failed && (m.kind === "TEXT" || m.kind === "POLL" || m.kind === "IMAGE");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!picker) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setPicker(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [picker]);
  const react = (emoji: string) => {
    setPicker(false);
    setOver({ base: m.reactions, value: toggleReaction(reactions, emoji) });
    start(async () => {
      const fd = new FormData();
      fd.set("messageId", m.id);
      fd.set("emoji", emoji);
      const res = await reactMessage(null, fd);
      if (res?.error) setOver(null);
      onChanged();
    });
  };
  return (
    <div className={`group flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""} ${showAuthor ? "mt-2.5" : "mt-0.5"}`}>
      {!mine && <div className="w-8 shrink-0 self-start">{showAuthor && m.user && <Avatar name={m.user.name} src={m.user.imageUrl} initial={m.user.initial} seed={m.user.id} size={32} frame={m.user.tier} />}</div>}
      <div ref={box} className={`relative flex max-w-[80%] flex-col sm:max-w-[65%] ${mine ? "items-end" : "items-start"}`}>
      {/* İfade seçici: balonun üstünde */}
      {picker && (
        <div className={`absolute -top-11 z-20 flex gap-0.5 rounded-full border border-border bg-card p-1 shadow-lg ${mine ? "right-0" : "left-0"}`}>
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`${e} ifadesini bırak`}
              onClick={() => react(e)}
              className={`flex size-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 ${reactions.some((r) => r.mine && r.emoji === e) ? "bg-primary/15" : "hover:bg-muted"}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div
        className={`relative max-w-full rounded-xl px-2.5 pb-1 pt-1.5 shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] sm:max-w-[65%] ${
          mine ? `bg-[var(--chat-mine)] text-[var(--chat-mine-fg)] ${showAuthor ? "bubble-tail-out rounded-tr-none" : ""}` : `bg-card ${showAuthor ? "bubble-tail-in rounded-tl-none" : ""}`
        } ${m.pending ? "opacity-70" : ""} ${m.failed ? "ring-2 ring-destructive" : ""}`}
      >
        {!mine && showAuthor && m.user && (
          <p className={`mb-0.5 flex items-center gap-1.5 text-[13px] font-bold leading-tight ${nameColor(m.user.id)}`}>
            <span className="truncate">{m.user.name}</span>
            {/* Seri: ismin hemen sağında, aynı hizada dik alev; içinde gün sayısı */}
            <StreakFlame s={m.user.streak} className="relative -my-1 -ml-0.5 -translate-y-px" big />
            {m.user.badge && <BadgeChip tag={m.user.badge} />}
          </p>
        )}
        {children}
        <p className={`-mt-0.5 flex items-center justify-end gap-0.5 text-[10px] leading-4 ${mine ? "opacity-60" : "text-muted-foreground"}`}>
          {m.failed ? "Gönderilemedi" : m.pending ? "Gönderiliyor…" : formatClock(m.createdAt)}
          {mine && !m.pending && !m.failed && <Check className="size-3" strokeWidth={2.5} />}
        </p>
      </div>
      {/* İfadeler: baloncuğun altına hafif biner; tıkla: ekle/kaldır, üstüne gel: kimler */}
      {reactions.length > 0 && (
        <div className={`-mt-1.5 flex flex-wrap gap-1 px-1.5 ${mine ? "justify-end" : ""}`}>
          {reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              disabled={!canReact}
              title={r.names.join(", ")}
              onClick={() => react(r.emoji)}
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 text-xs leading-5 shadow-sm transition-colors ${r.mine ? "border-primary/50 bg-primary/15" : "border-border bg-card hover:bg-muted"}`}
            >
              {r.emoji}
              {r.count > 1 && <span className="text-[10.5px] font-semibold text-muted-foreground">{r.count}</span>}
            </button>
          ))}
        </div>
      )}
      </div>
      {canReact && (
        <button
          type="button"
          className="btn-icon size-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-60 [&_svg]:size-3.5"
          aria-label="İfade bırak"
          onClick={() => setPicker((v) => !v)}
        >
          <SmilePlus />
        </button>
      )}
      {canDelete && !m.pending && <DeleteButton id={m.id} onDone={onChanged} />}
    </div>
  );
}

export function PollBody({ m, mine, onChanged }: { m: UiMessage; mine: boolean; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const poll = m.poll!;
  const max = Math.max(1, ...poll.options.map((o) => o.votes));
  return (
    <div className="min-w-[14rem] space-y-2">
      <p className="font-semibold">{poll.question}</p>
      <p className={`text-[11px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>{poll.multiple ? "Birden fazla seçebilirsin" : "Bir seçenek seç"}</p>
      <div className="space-y-1.5">
        {poll.options.map((o) => (
          <button
            key={o.id}
            disabled={pending}
            title={o.names.join(", ")}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                fd.set("optionId", o.id);
                await votePoll(null, fd);
                onChanged();
              })
            }
            className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              mine ? "border-current/20 hover:bg-black/5" : "border-border hover:bg-muted"
            }`}
          >
            <span
              className={`absolute inset-y-0 left-0 ${mine ? "bg-primary/15" : "bg-primary/10"} transition-all`}
              style={{ width: `${(o.votes / max) * 100}%` }}
            />
            <span className="relative flex items-center gap-2">
              <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${o.mine ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"}`}>
                {o.mine && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="flex-1">{o.text}</span>
              <span className="text-xs font-bold">{o.votes}</span>
            </span>
          </button>
        ))}
      </div>
      <p className={`text-[11px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>{poll.voters} kişi oy verdi</p>
    </div>
  );
}

/** Sohbetteki fotoğraf: önce küçük sürüm (hızlı ve az veri), tıklayınca büyük sürüm tam ekran */
export function ChatImage({ m }: { m: UiMessage }) {
  const [open, setOpen] = useState(false);
  const img = m.image;
  if (!img) return null;
  const w = img.w || 4;
  const h = img.h || 3;
  // Çok uzun ya da çok yatay fotoğraflar sohbeti kaplamasın
  const ratio = Math.min(1.6, Math.max(0.7, w / h));
  return (
    <>
      <button
        type="button"
        onClick={() => !m.pending && setOpen(true)}
        className="relative -mx-1.5 mb-1 block w-[min(17rem,70vw)] overflow-hidden rounded-lg bg-muted"
        style={{ aspectRatio: ratio }}
        aria-label="Fotoğrafı büyüt"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        {m.pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">%{Math.round((m.progress ?? 0) * 100)}</span>
          </span>
        )}
      </button>
      {m.text && (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
          {m.text}
          <span className="inline-block w-12" />
        </p>
      )}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-3" onClick={() => setOpen(false)} role="dialog" aria-label="Fotoğraf">
          <button className="btn-icon absolute right-3 top-3 text-white hover:bg-white/10" aria-label="Kapat" onClick={() => setOpen(false)}>
            <X />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.full} alt="" className="max-h-full max-w-full rounded object-contain" onClick={(e) => e.stopPropagation()} />
          {m.text && <p className="absolute inset-x-0 bottom-0 bg-black/50 p-3 text-center text-sm text-white">{m.text}</p>}
        </div>
      )}
    </>
  );
}
