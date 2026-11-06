import { BookCopy, Check, Library, Link2, X } from "lucide-react-native";
import { BOOK_CATALOG } from "@/lib/catalog";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApiFetch } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import { Button, Row } from "./ui";

export type BookSuggestion = { groupId: string; groupName: string; bookId: string; title: string; target: number; min: number };
type Ctx = { autoDone: Set<string>; suggestions: BookSuggestion[]; links: Record<string, BookSuggestion>; setLink: (bookId: string, s: BookSuggestion | null) => void };
const BookSuggestContext = createContext<Ctx | null>(null);
export const BookSuggestProvider = BookSuggestContext.Provider;

/** Grup kurarken: kurucunun diğer gruplarındaki eserler öneri olarak gelir; seçilenler "aynı eser" bağlanır */
export function useBookSuggest(enabled: boolean): Ctx & { linksJson: () => string } {
  const fetcher = useApiFetch();
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [links, setLinks] = useState<Record<string, BookSuggestion>>({});
  const [autoDone] = useState(() => new Set<string>());
  useEffect(() => {
    if (!enabled) return;
    fetcher<{ books: BookSuggestion[] }>("/api/m/my-books")
      .then((d) => setSuggestions(d.books ?? []))
      .catch(() => {});
  }, [enabled, fetcher]);
  const setLink = useCallback(
    (bookId: string, s: BookSuggestion | null) =>
      setLinks((l) => {
        const n = { ...l };
        if (s) n[bookId] = s;
        else delete n[bookId];
        return n;
      }),
    [],
  );
  return { autoDone, suggestions, links, setLink, linksJson: () => JSON.stringify(Object.entries(links).map(([bookId, s]) => ({ bookId, linkGroupId: s.groupId, linkBookId: s.bookId }))) };
}

const norm = (t: string) => t.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Seçilen eserin altında: kurucunun diğer gruplarında aynı eser varsa "aynı eser" bağı (ilk seferde kendiliğinden kurulur) */
export function BookSuggestions({ bookId, title }: { bookId: string; title: string; onPick?: (title: string) => void }) {
  const c = useColors();
  const ctx = useContext(BookSuggestContext);
  const first = ctx?.suggestions.find((s) => norm(s.title) === norm(title));
  useEffect(() => {
    if (!ctx || !first || ctx.links[bookId] || ctx.autoDone.has(bookId)) return;
    ctx.autoDone.add(bookId);
    ctx.setLink(bookId, first);
  }, [ctx, first, bookId]);
  if (!ctx || !ctx.suggestions.length) return null;
  const link = ctx.links[bookId];
  if (link) {
    return (
      <Row gap={6} style={{ backgroundColor: c.info + "1a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
        <Link2 size={13} color={c.info} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 11, color: c.info }}>“{link.groupName}” grubundaki “{link.title}” ile aynı eser sayılacak: birinde okuduğun diğerine de işlenir</Text>
        <Pressable onPress={() => ctx.setLink(bookId, null)} hitSlop={8} accessibilityLabel="Bağı kaldır">
          <X size={14} color={c.info} />
        </Pressable>
      </Row>
    );
  }
  const same = ctx.suggestions.filter((s) => norm(s.title) === norm(title));
  if (!same.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
      <Library size={11} color={c.mutedForeground} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Bu eseri başka grupta da okuyorsun:</Text>
      {same.map((s) => (
        <Pressable key={`${s.groupId}-${s.bookId}`} onPress={() => ctx.setLink(bookId, s)} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.card }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: c.foreground }}>{s.groupName} ile aynı say</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Katalogdan eser seçilince: diğer gruplarda aynı eser varsa bağla, yoksa bağı kaldır */
export function useAutoLink() {
  const ctx = useContext(BookSuggestContext);
  return (bookId: string, title: string) => {
    if (!ctx) return;
    ctx.autoDone.add(bookId);
    ctx.setLink(bookId, ctx.suggestions.find((s) => norm(s.title) === norm(title)) ?? null);
  };
}

/** Katalogdan eser seçimi (alttan açılan liste) */
export function BookPicker({ value, onChange }: { value: string; onChange: (title: string) => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flex: 1, height: 40, borderWidth: 1, borderColor: value ? c.border : "#f59e0b", borderRadius: 8, paddingHorizontal: 10, justifyContent: "center", backgroundColor: c.card }}
        accessibilityLabel="Eser seç"
      >
        <Text numberOfLines={1} style={{ fontFamily: value ? fonts.semibold : fonts.regular, fontSize: 14, color: value ? c.foreground : c.mutedForeground }}>
          {value || "Eser seç"}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "#0007", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", paddingBottom: insets.bottom + 8 }}>
            <Row style={{ padding: 16, paddingBottom: 8 }}>
              <Library size={20} color={c.primary} />
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: c.foreground }}>Eser seç</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <X size={22} color={c.mutedForeground} />
              </Pressable>
            </Row>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}>
              {BOOK_CATALOG.map((g) => (
                <View key={g.group} style={{ marginBottom: 6 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: c.mutedForeground, marginTop: 6, marginBottom: 2, marginLeft: 4 }}>{g.group.toLocaleUpperCase("tr-TR")}</Text>
                  {g.books.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => {
                        onChange(t);
                        setOpen(false);
                      }}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 11, borderRadius: 10, backgroundColor: pressed || t === value ? c.muted : "transparent" })}
                    >
                      <Text style={{ fontFamily: t === value ? fonts.bold : fonts.regular, fontSize: 15, color: t === value ? c.primary : c.foreground }}>{t}</Text>
                      {t === value && <Check size={18} color={c.primary} />}
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Ad elle değiştirilince bağ kopar */
export function useUnlinkOnEdit() {
  const ctx = useContext(BookSuggestContext);
  return (bookId: string, newTitle: string) => {
    const l = ctx?.links[bookId];
    if (l && norm(l.title) !== norm(newTitle)) ctx!.setLink(bookId, null);
  };
}

type Match = { book: { id: string; title: string; target: number }; other: BookSuggestion; score: number };
type Answer = "same" | "no" | "more";

/**
 * Katılmadan önce: gruptaki eserler kullanıcının diğer gruplarındaki eserlerle karşılaştırılır,
 * benzerler için "aynı eser mi?" sorulur. check() sonunda proceed(bookLinks JSON) çağrılır.
 */
export function useBookCheck(): { check: (groupId: string, teamId: string | null | undefined, proceed: (links: string) => void) => void; modal: ReactNode } {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const fetcher = useApiFetch();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const next = useRef<((links: string) => void) | null>(null);

  const check = useCallback(
    (groupId: string, teamId: string | null | undefined, proceed: (links: string) => void) => {
      next.current = proceed;
      fetcher<{ matches: Match[] }>(`/api/m/groups/${groupId}/book-matches${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`)
        .then((d) => {
          if (!d.matches?.length) return proceed("[]");
          setAnswers({});
          setMatches(d.matches);
        })
        .catch(() => proceed("[]"));
    },
    [fetcher],
  );

  const done = matches?.every((_, i) => answers[i]);
  const modal = (
    <Modal visible={!!matches} transparent animationType="slide" onRequestClose={() => setMatches(null)}>
      <Pressable onPress={() => setMatches(null)} style={{ flex: 1, backgroundColor: "#0007", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", paddingBottom: insets.bottom + 12 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Row style={{ alignItems: "flex-start" }}>
              <BookCopy size={20} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: c.foreground }}>Bu eserleri zaten okuyor olabilirsin</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>Aynı eserse bir grupta işaretlediğin sayfa diğerine de işlenir; iki kez okuman gerekmez.</Text>
              </View>
              <Pressable onPress={() => setMatches(null)} hitSlop={10}>
                <X size={22} color={c.mutedForeground} />
              </Pressable>
            </Row>
            {matches?.map((m, i) => (
              <View key={i} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, gap: 8 }}>
                <Row gap={8} style={{ alignItems: "stretch" }}>
                  <View style={{ flex: 1, backgroundColor: c.primary + "12", borderRadius: 10, padding: 8 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.primary }}>BU GRUPTA</Text>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{m.book.title}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>günde {m.book.target} sf</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: c.muted, borderRadius: 10, padding: 8 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 10, color: c.mutedForeground }}>
                      {m.other.groupName.toLocaleUpperCase("tr-TR")}
                    </Text>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{m.other.title}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>günde {m.other.target} sf</Text>
                  </View>
                </Row>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.foreground }}>Bunlar aynı eser mi?</Text>
                {(
                  [
                    ["same", "Evet, aynı eser", "Birinde işaretlediğim sayfa diğerinde de sayılsın"],
                    ["no", "Hayır, farklı eser", "Ayrı ayrı okuyup bildireceğim"],
                    ["more", "Aynı eser ama ayrı sayılsın", "Daha fazla sayfa okuyacağım; iki grubun sayfaları toplanır"],
                  ] as const
                ).map(([k, label, hint]) => (
                  <Pressable
                    key={k}
                    onPress={() => setAnswers((a) => ({ ...a, [i]: k }))}
                    style={{ borderWidth: 1.5, borderColor: answers[i] === k ? c.primary : c.border, backgroundColor: answers[i] === k ? c.primary + "14" : c.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}
                  >
                    <Row gap={5}>
                      {k === "same" && <Link2 size={13} color={c.info} />}
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{label}</Text>
                    </Row>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>{hint}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            <Button
              title={done ? "Devam et" : "Her eser için bir seçim yap"}
              disabled={!done}
              onPress={() => {
                const json = JSON.stringify((matches ?? []).filter((_, i) => answers[i] === "same").map((m) => ({ bookId: m.book.id, linkGroupId: m.other.groupId, linkBookId: m.other.bookId })));
                setMatches(null);
                next.current?.(json);
              }}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
  return { check, modal };
}
