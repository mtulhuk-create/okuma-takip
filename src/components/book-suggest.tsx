"use client";

import { Link2, Library, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

export type BookSuggestion = { groupId: string; groupName: string; bookId: string; title: string; target: number; min: number };

type Ctx = {
  suggestions: BookSuggestion[];
  links: Record<string, BookSuggestion>;
  setLink: (bookId: string, s: BookSuggestion | null) => void;
};
const BookSuggestContext = createContext<Ctx | null>(null);

/** Grup kurarken: kurucunun üyesi olduğu gruplardaki eserler öneri olarak gelir; seçilenler "aynı eser" bağlanır */
export function BookSuggestProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [links, setLinks] = useState<Record<string, BookSuggestion>>({});
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/m/my-books", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { books: [] }))
      .then((d) => setSuggestions(d.books ?? []))
      .catch(() => {});
  }, [enabled]);
  const setLink = (bookId: string, s: BookSuggestion | null) =>
    setLinks((l) => {
      const n = { ...l };
      if (s) n[bookId] = s;
      else delete n[bookId];
      return n;
    });
  return (
    <BookSuggestContext.Provider value={{ suggestions, links, setLink }}>
      {children}
      <input type="hidden" name="bookLinks" value={JSON.stringify(Object.entries(links).map(([bookId, s]) => ({ bookId, linkGroupId: s.groupId, linkBookId: s.bookId })))} />
    </BookSuggestContext.Provider>
  );
}

const norm = (t: string) => t.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Eser adı alanının altında: diğer gruplardaki eserler (dokununca ad gelir ve aynı eser sayılır) */
export function BookSuggestions({ bookId, title, onPick }: { bookId: string; title: string; onPick: (title: string) => void }) {
  const ctx = useContext(BookSuggestContext);
  if (!ctx || !ctx.suggestions.length) return null;
  const link = ctx.links[bookId];
  if (link) {
    return (
      <p className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-800 dark:text-sky-300">
        <Link2 className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          “{link.groupName}” grubundaki eserle aynı sayılacak: birinde okuduğun diğerine de işlenir
        </span>
        <button type="button" onClick={() => ctx.setLink(bookId, null)} aria-label="Bağı kaldır" className="shrink-0">
          <X className="size-3.5" />
        </button>
      </p>
    );
  }
  const q = norm(title);
  const list = ctx.suggestions.filter((s) => !q || norm(s.title).includes(q) || q.includes(norm(s.title))).slice(0, 6);
  if (!list.length) return null;
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Library className="size-3" /> Diğer gruplarındaki eserler
      </p>
      <div className="flex flex-wrap gap-1">
        {list.map((s) => (
          <button
            key={`${s.groupId}-${s.bookId}`}
            type="button"
            onClick={() => {
              onPick(s.title);
              ctx.setLink(bookId, s);
            }}
            className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] hover:border-primary/50 hover:bg-primary/5"
          >
            <b>{s.title}</b> <span className="text-muted-foreground">· {s.groupName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Kullanıcı adı elle değiştirince bağ kopar */
export function useUnlinkOnEdit() {
  const ctx = useContext(BookSuggestContext);
  return (bookId: string, newTitle: string) => {
    const l = ctx?.links[bookId];
    if (l && norm(l.title) !== norm(newTitle)) ctx!.setLink(bookId, null);
  };
}
