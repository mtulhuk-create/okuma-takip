"use client";

import { Send, Shield, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { requestJoin } from "@/app/actions";
import { SubmitButton } from "./action-form";
import { JoinForm } from "./join-form";

type TeamInfo = { id: string; name: string; targetPages: number; minPages: number; penalty: string };

/**
 * Katılma isteği: kartta yalnızca buton; ekip seçimi ve yöneticiye not bu pencerede.
 * Göndermeden önce benzer eserler için "aynı eser mi?" sorusu (JoinForm) yine sorulur.
 */
export function JoinDialog({ groupId, groupName, teams }: { groupId: string; groupName: string; teams: TeamInfo[] }) {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<string>("");
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className="btn-primary h-10 w-full" onClick={() => setOpen(true)}>
        <UserPlus /> Katılma isteği gönder
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={close} role="dialog" aria-modal="true" aria-labelledby={`join-${groupId}`}>
          <div className="pb-safe w-full max-w-md space-y-4 rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 id={`join-${groupId}`} className="text-lg font-semibold leading-tight">
                  Gruba katılma isteği
                </h2>
                <p className="text-sm font-medium [overflow-wrap:anywhere]">{groupName}</p>
                <p className="text-sm text-muted-foreground">
                  İsteğin grubun yöneticisine gider; yönetici onaylayınca gruba katılırsın.
                  {teams.length ? " Bu grupta üyeler ekiplere ayrılır: her ekibin kendi günlük hedefi ve cezası vardır." : ""}
                </p>
              </div>
              <button className="btn-icon size-8 shrink-0" onClick={close} aria-label="Kapat">
                <X />
              </button>
            </div>

            <JoinForm action={requestJoin} groupId={groupId} className="space-y-4" onDone={close}>
              <input type="hidden" name="groupId" value={groupId} />
              {teams.length > 0 && (
                <fieldset className="space-y-1.5">
                  <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                    <Shield className="size-4 text-primary" /> Ekibini seç
                  </legend>
                  {teams.map((t) => (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${team === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                    >
                      <input type="radio" name="teamId" value={t.id} required checked={team === t.id} onChange={() => setTeam(t.id)} className="mt-1 accent-[var(--primary)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{t.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Günde {t.targetPages} sayfa · alt sınır {t.minPages} · {t.penalty}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="space-y-1.5">
                <label htmlFor={`note-${groupId}`} className="text-sm font-medium">
                  Yöneticiye not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
                </label>
                <textarea id={`note-${groupId}`} name="message" maxLength={300} rows={3} placeholder="Kendini kısaca tanıtabilirsin" className="input min-h-20 resize-none py-2" />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="btn-ghost" onClick={close}>
                  Vazgeç
                </button>
                <SubmitButton className="btn-primary">
                  <Send /> İsteği gönder
                </SubmitButton>
              </div>
            </JoinForm>
          </div>
        </div>
      )}
    </>
  );
}
