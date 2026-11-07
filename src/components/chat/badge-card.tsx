"use client";

import { Check, Plus, Tag, X } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteBadgeOption, proposeBadge, removeBadge, voteBadge } from "@/app/actions";
import type { ChatMessage } from "@/lib/chat";
import { BadgeChip } from "../badge-chip";
import { Countdown } from "../countdown";

type BadgeView = NonNullable<ChatMessage["badge"]>;

function useRun(onChanged: () => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: (p: null, fd: FormData) => Promise<{ error?: string } | null | undefined | unknown>, fields: Record<string, string>, after?: () => void) =>
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = (await action(null, fd)) as { error?: string } | null | undefined;
      setError(res?.error ?? null);
      if (!res?.error) after?.();
      onChanged();
    });
  return { pending, error, run };
}

/** Sohbetteki rozet kartı: oylama, kazanıldı ya da kalktı */
export function BadgeCard({ b, onChanged }: { b: BadgeView; onChanged: () => void }) {
  if (b.event === "VOTE") return <VoteCard b={b} onChanged={onChanged} />;
  return <AnnounceCard b={b} onChanged={onChanged} />;
}

function AnnounceCard({ b, onChanged }: { b: BadgeView; onChanged: () => void }) {
  const { pending, run } = useRun(onChanged);
  const tag = { kind: b.kind, label: b.label ?? "" };
  const good = b.kind === "GOOD";
  let text: React.ReactNode;
  if (b.event === "AWARD") text = good ? <>🌟 <b>{b.user.name}</b> 7 gün üst üste tam okudu</> : <><b>{b.user.name}</b> rozetini aldı</>;
  else text = good ? <><b>{b.user.name}</b> 2 gün tam okumadı, rozeti kalktı</> : <>🎉 <b>{b.user.name}</b> 2 gün tam okudu, rozeti kalktı</>;
  return (
    <div className={`mx-auto my-3 w-fit max-w-sm rounded-2xl px-4 py-2.5 text-center text-sm shadow-xs ${good ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-orange-50 dark:bg-orange-500/10"}`}>
      <p>{text}</p>
      {b.label && (
        <p className="mt-1.5 flex items-center justify-center gap-2">
          <BadgeChip tag={tag} className={b.event === "END" ? "line-through opacity-60" : "text-xs"} />
          {b.event === "AWARD" && b.status !== "ACTIVE" && <span className="text-xs text-muted-foreground">(kalktı)</span>}
        </p>
      )}
      {b.event === "AWARD" && b.status === "ACTIVE" && (
        <p className="mt-1 text-[11px] text-muted-foreground">{good ? "Sonraki günlerde 2 gün tam okunmazsa kalkar." : "Sonraki günlerde 2 gün tam okursa kalkar."}</p>
      )}
      {b.event === "AWARD" && b.canRemove && (
        <button className="btn-ghost btn-sm mt-1 h-7 text-xs" disabled={pending} onClick={() => confirm("Bu rozet kaldırılsın mı?") && run(removeBadge, { badgeId: b.id })}>
          Rozeti kaldır
        </button>
      )}
    </div>
  );
}

function VoteCard({ b, onChanged }: { b: BadgeView; onChanged: () => void }) {
  const { pending, error, run } = useRun(onChanged);
  const [label, setLabel] = useState("");
  const max = Math.max(1, ...b.options.map((o) => o.votes));
  const total = b.options.reduce((n, o) => n + o.votes, 0);
  const words = label.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="mx-auto my-4 max-w-md overflow-hidden rounded-2xl border border-dashed border-orange-300 bg-card shadow-sm dark:border-orange-500/40">
      <div className="flex items-start gap-3 bg-orange-50 px-4 py-3 dark:bg-orange-500/10">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white">
          <Tag className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">Rozet oylaması · {b.user.name}</p>
          <p className="text-xs text-muted-foreground">
            {b.isMe ? "7 gündür tam okuyamadın; grup arkadaşların sana latife bir rozet seçiyor." : "7 gündür tam okuyamadı. Ona latife bir rozet önerin ve oylayın (en fazla 2 kelime)."}
          </p>
        </div>
      </div>

      <div className="space-y-2 p-3">
        {b.voting && b.voteUntil && (
          <p className="text-xs text-muted-foreground">
            Oylama bitimine <Countdown to={b.voteUntil} className="font-semibold" /> · {total} oy · eşitlikte rastgele seçilir
          </p>
        )}
        {!b.voting && (
          <p className="text-sm">
            {b.status === "CANCELLED" ? (
              <span className="text-muted-foreground">Rozet verilmedi (şık önerilmedi ya da oylama iptal edildi).</span>
            ) : b.label ? (
              <span className="flex flex-wrap items-center gap-2">
                Sonuç: <BadgeChip tag={{ kind: b.kind, label: b.label }} className="text-xs" />
                {b.status === "ENDED" && <span className="text-xs text-muted-foreground">(kalktı)</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">Oylama sonuçlanıyor…</span>
            )}
          </p>
        )}

        {b.options.length === 0 && b.voting && <p className="text-sm text-muted-foreground">Henüz şık önerilmedi.</p>}
        <ul className="space-y-1.5">
          {b.options.map((o) => (
            <li key={o.id} className="flex items-center gap-1.5">
              <button
                disabled={!b.canVote || pending}
                onClick={() => run(voteBadge, { badgeId: b.id, optionId: o.id })}
                className={`relative flex min-h-9 flex-1 items-center gap-2 overflow-hidden rounded-lg border px-3 text-left text-sm ${o.mine ? "border-orange-400" : "border-border"} ${b.canVote ? "hover:bg-muted/50" : "cursor-default"}`}
              >
                <span className="absolute inset-y-0 left-0 bg-orange-500/15" style={{ width: `${(o.votes / max) * 100}%` }} />
                <span className="relative flex size-4 shrink-0 items-center justify-center rounded-full border border-orange-400">{o.mine && <Check className="size-3 text-orange-600" strokeWidth={3} />}</span>
                <span className="relative flex-1 font-semibold">{o.label}</span>
                <span className="relative text-xs font-bold text-muted-foreground">{o.votes}</span>
              </button>
              {o.canDelete && (
                <button className="btn-icon size-8 [&_svg]:size-4" aria-label="Şıkkı kaldır" disabled={pending} onClick={() => confirm(`"${o.label}" şıkkı kaldırılsın mı?`) && run(deleteBadgeOption, { optionId: o.id })}>
                  <X />
                </button>
              )}
            </li>
          ))}
        </ul>

        {b.canVote && !b.proposed && (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              run(proposeBadge, { badgeId: b.id, label }, () => setLabel(""));
            }}
          >
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24} placeholder="Rozet öner (en fazla 2 kelime)" className="input h-9 flex-1 text-sm" />
            <button className="btn-primary h-9 px-3 text-sm" disabled={pending || !label.trim() || words > 2}>
              <Plus /> Öner
            </button>
          </form>
        )}
        {b.canVote && b.proposed && <p className="text-[11px] text-muted-foreground">Şıkkını önerdin; istediğin şıkka oy verebilirsin.</p>}
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        {b.canRemove && (
          <button
            className="btn-ghost btn-sm h-7 text-xs text-muted-foreground"
            disabled={pending}
            onClick={() => confirm(b.status === "VOTING" ? "Oylama iptal edilsin mi?" : "Rozet kaldırılsın mı?") && run(removeBadge, { badgeId: b.id })}
          >
            {b.status === "VOTING" ? "Oylamayı iptal et" : "Rozeti kaldır"}
          </button>
        )}
      </div>
    </div>
  );
}
