"use client";

import { Link2, Library, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

export type BookSuggestion = { groupId: string; groupName: string; bookId: string; title: string; target: number; min: number };

type Ctx = {
  /** Kendiliğinden bağlanmış eserler (kullanıcı kaldırırsa tekrar bağlanmaz) */
  autoDone: Set<string>;
  suggestions: BookSuggestion[];
  links: Record<string, BookSuggestion>;
  setLink: (bookId: string, s: BookSuggestion | null) => void;
};
const BookSuggestContext = createContext<Ctx | null>(null);

/** Grup kurarken: kurucunun üyesi olduğu gruplardaki eserler öneri olarak gelir; seçilenler "aynı eser" bağlanır */
export function BookSuggestProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [links, setLinks] = useState<Record<string, BookSuggestion>>({});
  const [autoDone] = useState(() => new Set<string>());
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
    <BookSuggestContext.Provider value={{ autoDone, suggestions, links, setLink }}>
      {children}
      <input type="hidden" name="bookLinks" value={JSON.stringify(Object.entries(links).map(([bookId, s]) => ({ bookId, linkGroupId: s.groupId, linkBookId: s.bookId })))} />
    </BookSuggestContext.Provider>
  );
}

const norm = (t: string) => t.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Seçilen eserin altında: kurucunun diğer gruplarında aynı eser varsa "aynı eser" bağı
 * (seçince kendiliğinden kurulur, isterse kaldırır ya da yeniden kurar).
 */
export function BookSuggestions({ bookId, title }: { bookId: string; title: string; onPick?: (title: string) => void }) {
  const ctx = useContext(BookSuggestContext);
  const first = ctx?.suggestions.find((s) => norm(s.title) === norm(title));
  // Varsayılan / önceden seçili eser diğer gruplarda da varsa ilk seferde kendiliğinden bağla
  useEffect(() => {
    if (!ctx || !first || ctx.links[bookId] || ctx.autoDone.has(bookId)) return;
    ctx.autoDone.add(bookId);
    ctx.setLink(bookId, first);
  }, [ctx, first, bookId]);
  if (!ctx || !ctx.suggestions.length) return null;
  const link = ctx.links[bookId];
  if (link) {
    return (
      <p className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-800 dark:text-sky-300">
        <Link2 className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">“{link.groupName}” grubundaki “{link.title}” ile aynı eser sayılacak: birinde okuduğun diğerine de işlenir</span>
        <button type="button" onClick={() => ctx.setLink(bookId, null)} aria-label="Bağı kaldır" className="shrink-0">
          <X className="size-3.5" />
        </button>
      </p>
    );
  }
  const same = ctx.suggestions.filter((s) => norm(s.title) === norm(title));
  if (!same.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      <Library className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">Bu eseri başka grupta da okuyorsun:</span>
      {same.map((s) => (
        <button key={`${s.groupId}-${s.bookId}`} type="button" onClick={() => ctx.setLink(bookId, s)} className="rounded-full border border-border bg-card px-2 py-0.5 hover:border-primary/50">
          {s.groupName} ile aynı say
        </button>
      ))}
    </div>
  );
}

/** Katalogdan eser seçilince: diğer gruplarda aynı eser varsa kendiliğinden bağla, yoksa bağı kaldır */
export function useAutoLink() {
  const ctx = useContext(BookSuggestContext);
  return (bookId: string, title: string) => {
    if (!ctx) return;
    const same = ctx.suggestions.find((s) => norm(s.title) === norm(title));
    ctx.autoDone.add(bookId);
    ctx.setLink(bookId, same ?? null);
  };
}

/** Kullanıcı adı elle değiştirince bağ kopar */
export function useUnlinkOnEdit() {
  const ctx = useContext(BookSuggestContext);
  return (bookId: string, newTitle: string) => {
    const l = ctx?.links[bookId];
    if (l && norm(l.title) !== norm(newTitle)) ctx!.setLink(bookId, null);
  };
}
