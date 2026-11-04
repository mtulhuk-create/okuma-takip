"use client";

import { useState } from "react";
import { reportReading } from "@/app/actions";
import { ActionForm, SubmitButton } from "./action-form";

export function ReportButtons({ groupId, dailyPages, current }: { groupId: string; dailyPages: number; current?: number | null }) {
  const [custom, setCustom] = useState(false);
  return (
    <div className="space-y-2">
      {current != null && (
        <p className="text-sm text-foreground/80">
          Bugün bildirdiğin: <b>{current}</b> / {dailyPages} sayfa {current >= dailyPages ? "✅" : "⚠️"}
        </p>
      )}
      <ActionForm action={reportReading} className="flex flex-wrap gap-2">
        <input type="hidden" name="groupId" value={groupId} />
        {custom ? (
          <>
            <input
              name="pages"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={current ?? dailyPages}
              className="input w-28"
              autoFocus
            />
            <SubmitButton name="choice" value="pages" className="btn-success">
              Kaydet
            </SubmitButton>
            <button type="button" className="btn-ghost" onClick={() => setCustom(false)}>
              Vazgeç
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-success flex-1" onClick={() => setCustom(true)}>
              📖 Okudum
            </button>
            <SubmitButton name="choice" value="min" className="btn-primary flex-1">
              ✅ Alt sınırı okudum ({dailyPages})
            </SubmitButton>
            <SubmitButton name="choice" value="none" className="btn-ghost flex-1">
              ❌ Okumadım
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  );
}
