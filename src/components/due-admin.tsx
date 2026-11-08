"use client";

import { BadgePercent, Hourglass } from "lucide-react";
import { useState } from "react";
import { discountAction, extendDueAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "./action-form";

/** Vadeye ek süre: hızlı +1/+3/+7 gün ya da istenen tarih */
export function ExtendForm({ dueId, defaultValue }: { dueId: string; defaultValue: string }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-amber-500/10 p-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <Hourglass className="size-3.5" /> Ek süre ver
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[1, 3, 7].map((d) => (
          <ActionForm key={d} action={extendDueAction}>
            <input type="hidden" name="dueId" value={dueId} />
            <input type="hidden" name="days" value={d} />
            <SubmitButton className="btn-ghost btn-sm">+{d} gün</SubmitButton>
          </ActionForm>
        ))}
      </div>
      <ActionForm action={extendDueAction} className="flex gap-1.5">
        <input type="hidden" name="dueId" value={dueId} />
        <input type="datetime-local" name="dueAt" defaultValue={defaultValue} className="input h-8 text-xs" required />
        <SubmitButton className="btn-ghost btn-sm shrink-0">Uzat</SubmitButton>
      </ActionForm>
    </div>
  );
}

/** Ceza indirimi: % ya da TL. penaltyId → tek ceza, userId → kişinin tüm cezaları, ikisi de yoksa tüm grup */
export function DiscountForm({ groupId, userId, penaltyId, title = "İndirim yap", compact }: { groupId: string; userId?: string; penaltyId?: string; title?: string; compact?: boolean }) {
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  return (
    <ActionForm action={discountAction} className={compact ? "flex min-w-0 flex-1 items-center gap-1" : "space-y-1.5 rounded-lg bg-emerald-500/10 p-2"}>
      <input type="hidden" name="groupId" value={groupId} />
      {userId && <input type="hidden" name="userId" value={userId} />}
      {penaltyId && <input type="hidden" name="penaltyId" value={penaltyId} />}
      <input type="hidden" name="mode" value={mode} />
      {!compact && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <BadgePercent className="size-3.5" /> {title}
        </p>
      )}
      <div className="flex min-w-0 items-center gap-1">
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-xs font-semibold">
          {(["percent", "amount"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`px-2 py-1.5 ${mode === m ? "bg-primary text-primary-foreground" : "bg-card"}`}>
              {m === "percent" ? "%" : "TL"}
            </button>
          ))}
        </div>
        <input name="value" type="number" inputMode="numeric" min={1} max={mode === "percent" ? 100 : undefined} placeholder={mode === "percent" ? "50" : "20"} className="input h-8 w-16 min-w-0 flex-1 px-2 text-xs sm:max-w-24" required />
        <SubmitButton className="btn-success btn-sm shrink-0">{compact ? "İndir" : "Uygula"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
