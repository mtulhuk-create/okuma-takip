"use client";

import { Check, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteMessage, votePoll } from "@/app/actions";
import type { ChatMessage } from "@/lib/chat";
import { formatClock } from "@/lib/schedule";
import { Avatar } from "../avatar";
import { BadgeChip } from "../badge-chip";
import { StreakChip } from "../history-grid";

const NAME_COLORS = ["text-rose-700", "text-amber-700", "text-emerald-700", "text-sky-700", "text-violet-700", "text-orange-700", "text-teal-700"];
function nameColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${NAME_COLORS[h % NAME_COLORS.length]} dark:brightness-150`;
}

export type UiMessage = ChatMessage & { pending?: boolean; failed?: boolean };

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
  return (
    <div className={`group flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""} ${showAuthor ? "mt-2.5" : "mt-0.5"}`}>
      {!mine && <div className="w-8 shrink-0 self-start">{showAuthor && m.user && <Avatar name={m.user.name} src={m.user.imageUrl} initial={m.user.initial} seed={m.user.id} size={32} frame={m.user.tier} />}</div>}
      <div
        className={`relative max-w-[80%] rounded-xl px-2.5 pb-1 pt-1.5 shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] sm:max-w-[65%] ${
          mine ? `bg-[var(--chat-mine)] text-[var(--chat-mine-fg)] ${showAuthor ? "bubble-tail-out rounded-tr-none" : ""}` : `bg-card ${showAuthor ? "bubble-tail-in rounded-tl-none" : ""}`
        } ${m.pending ? "opacity-70" : ""} ${m.failed ? "ring-2 ring-destructive" : ""}`}
      >
        {!mine && showAuthor && m.user && (
          <p className={`mb-0.5 flex items-center gap-1.5 text-[13px] font-bold leading-tight ${nameColor(m.user.id)}`}>
            <span className="truncate">{m.user.name}</span>
            {m.user.badge && <BadgeChip tag={m.user.badge} />}
            <StreakChip s={m.user.streak} />
          </p>
        )}
        {children}
        <p className={`-mt-0.5 flex items-center justify-end gap-0.5 text-[10px] leading-4 ${mine ? "opacity-60" : "text-muted-foreground"}`}>
          {m.failed ? "Gönderilemedi" : m.pending ? "Gönderiliyor…" : formatClock(m.createdAt)}
          {mine && !m.pending && !m.failed && <Check className="size-3" strokeWidth={2.5} />}
        </p>
      </div>
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
