"use client";

import { Check, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteMessage, votePoll } from "@/app/actions";
import type { ChatMessage } from "@/lib/chat";
import { formatClock } from "@/lib/schedule";
import { Avatar } from "../avatar";

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
      className="btn-icon size-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [&_svg]:size-3.5"
      aria-label="Mesajı sil"
      disabled={pending}
      onClick={() => {
        if (!confirm("Bu mesaj silinsin mi?")) return;
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

/** Metin ve anket mesajları için balon çerçevesi */
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
    <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${showAuthor ? "mt-3" : "mt-0.5"}`}>
      {!mine && <div className="w-8 shrink-0">{showAuthor && m.user && <Avatar name={m.user.name} src={m.user.imageUrl} size={32} />}</div>}
      <div
        className={`relative max-w-[80%] rounded-2xl px-3 py-2 shadow-xs sm:max-w-[70%] ${
          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card"
        } ${m.pending ? "opacity-70" : ""} ${m.failed ? "ring-2 ring-destructive" : ""}`}
      >
        {!mine && showAuthor && m.user && <p className={`mb-0.5 text-xs font-bold ${nameColor(m.user.id)}`}>{m.user.name}</p>}
        {children}
        <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {m.failed ? "Gönderilemedi" : m.pending ? "Gönderiliyor…" : formatClock(m.createdAt)}
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
      <p className={`text-[11px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{poll.multiple ? "Birden fazla seçebilirsin" : "Bir seçenek seç"}</p>
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
              mine ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border hover:bg-muted"
            }`}
          >
            <span
              className={`absolute inset-y-0 left-0 ${mine ? "bg-primary-foreground/20" : "bg-primary/10"} transition-all`}
              style={{ width: `${(o.votes / max) * 100}%` }}
            />
            <span className="relative flex items-center gap-2">
              <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${o.mine ? (mine ? "border-primary-foreground bg-primary-foreground text-primary" : "border-primary bg-primary text-primary-foreground") : mine ? "border-primary-foreground/60" : "border-muted-foreground/50"}`}>
                {o.mine && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="flex-1">{o.text}</span>
              <span className="text-xs font-bold">{o.votes}</span>
            </span>
          </button>
        ))}
      </div>
      <p className={`text-[11px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{poll.voters} kişi oy verdi</p>
    </div>
  );
}
