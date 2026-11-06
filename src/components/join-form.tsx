"use client";

import { BookCopy, Link2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";

type Match = {
  book: { id: string; title: string; target: number };
  other: { groupId: string; groupName: string; bookId: string; title: string; target: number };
  score: number;
};
type Answer = "same" | "no" | "more";

/**
 * Katılma isteği / davet kabulü formu. Göndermeden önce gruptaki eserler kullanıcının diğer gruplarındaki
 * eserlerle karşılaştırılır; benzerler için "aynı eser mi?" diye sorulur. "Evet" denilenler bağlanır:
 * birinde okunan sayfa diğerine de işlenir. "Hayır" ya da "aynı ama ayrı sayılsın" denilenler ayrı kalır.
 */
export function JoinForm({
  action,
  groupId,
  className,
  children,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  groupId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const checked = useRef(false);
  const submitter = useRef<HTMLElement | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [links, setLinks] = useState("[]");

  useEffect(() => {
    if (state) checked.current = false;
  }, [state]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const sub = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    // Daveti reddederken sormaya gerek yok
    if (checked.current || (sub?.name === "accept" && sub.value !== "1")) return;
    e.preventDefault();
    submitter.current = sub;
    const teamId = new FormData(e.currentTarget).get("teamId");
    const res = await fetch(`/api/m/groups/${groupId}/book-matches${teamId ? `?teamId=${encodeURIComponent(String(teamId))}` : ""}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { matches: Match[] }) : { matches: [] };
    if (!data.matches.length) return send("[]");
    setAnswers({});
    setMatches(data.matches);
  }

  function send(json: string) {
    setLinks(json);
    checked.current = true;
    setMatches(null);
    // Gizli alan güncellendikten sonra gönder
    requestAnimationFrame(() => ref.current?.requestSubmit(submitter.current ?? undefined));
  }

  const allAnswered = matches?.every((_, i) => answers[i]);

  return (
    <>
      <form ref={ref} action={formAction} onSubmit={onSubmit} className={className}>
        <input type="hidden" name="bookLinks" value={links} />
        {children}
        {state?.error && <p className="mt-2 w-full basis-full text-sm font-medium text-destructive">{state.error}</p>}
        {state?.ok && state.message && <p className="mt-2 w-full basis-full text-sm font-medium text-emerald-600">{state.message}</p>}
      </form>

      {matches && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setMatches(null)}>
          <div className="pb-safe max-h-[85dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <BookCopy className="size-5 text-primary" /> Bu eserleri zaten okuyor olabilirsin
                </h2>
                <p className="text-xs text-muted-foreground">Aynı eserse bir grupta işaretlediğin sayfa diğerine de işlenir; iki kez okuman gerekmez.</p>
              </div>
              <button className="btn-icon size-8 shrink-0" onClick={() => setMatches(null)} aria-label="Kapat">
                <X />
              </button>
            </div>
            {matches.map((m, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-primary/5 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Bu grupta</p>
                    <p className="font-semibold">{m.book.title}</p>
                    <p className="text-muted-foreground">günde {m.book.target} sf</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{m.other.groupName}</p>
                    <p className="font-semibold">{m.other.title}</p>
                    <p className="text-muted-foreground">günde {m.other.target} sf</p>
                  </div>
                </div>
                <p className="text-xs font-semibold">Bunlar aynı eser mi?</p>
                <div className="grid gap-1.5">
                  {(
                    [
                      ["same", "Evet, aynı eser", "Birinde işaretlediğim sayfa diğerinde de sayılsın"],
                      ["no", "Hayır, farklı eser", "Ayrı ayrı okuyup bildireceğim"],
                      ["more", "Aynı eser ama ayrı sayılsın", "Daha fazla sayfa okuyacağım; iki grubun sayfaları toplanır"],
                    ] as const
                  ).map(([k, label, hint]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [i]: k }))}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${answers[i] === k ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {k === "same" && <Link2 className="size-3.5 text-sky-600" />}
                        {label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              className="btn-primary w-full"
              disabled={!allAnswered}
              onClick={() =>
                send(JSON.stringify(matches.filter((_, i) => answers[i] === "same").map((m) => ({ bookId: m.book.id, linkGroupId: m.other.groupId, linkBookId: m.other.bookId }))))
              }
            >
              {allAnswered ? "Devam et" : "Her eser için bir seçim yap"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
