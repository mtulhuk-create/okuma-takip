import { BookCopy, Library, Link2, X } from "lucide-react-native";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApiFetch } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import { Button, Row } from "./ui";

export type BookSuggestion = { groupId: string; groupName: string; bookId: string; title: string; target: number; min: number };
type Ctx = { suggestions: BookSuggestion[]; links: Record<string, BookSuggestion>; setLink: (bookId: string, s: BookSuggestion | null) => void };
const BookSuggestContext = createContext<Ctx | null>(null);
export const BookSuggestProvider = BookSuggestContext.Provider;

/** Grup kurarken: kurucunun diğer gruplarındaki eserler öneri olarak gelir; seçilenler "aynı eser" bağlanır */
export function useBookSuggest(enabled: boolean): Ctx & { linksJson: () => string } {
  const fetcher = useApiFetch();
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [links, setLinks] = useState<Record<string, BookSuggestion>>({});
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
  return { suggestions, links, setLink, linksJson: () => JSON.stringify(Object.entries(links).map(([bookId, s]) => ({ bookId, linkGroupId: s.groupId, linkBookId: s.bookId }))) };
}

const norm = (t: string) => t.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Eser adının altında: diğer gruplarındaki eserler (dokununca ad gelir ve aynı eser sayılır) */
export function BookSuggestions({ bookId, title, onPick }: { bookId: string; title: string; onPick: (title: string) => void }) {
  const c = useColors();
  const ctx = useContext(BookSuggestContext);
  if (!ctx || !ctx.suggestions.length) return null;
  const link = ctx.links[bookId];
  if (link) {
    return (
      <Row gap={6} style={{ backgroundColor: c.info + "1a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
        <Link2 size={13} color={c.info} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 11, color: c.info }}>“{link.groupName}” grubundaki eserle aynı sayılacak: birinde okuduğun diğerine de işlenir</Text>
        <Pressable onPress={() => ctx.setLink(bookId, null)} hitSlop={8} accessibilityLabel="Bağı kaldır">
          <X size={14} color={c.info} />
        </Pressable>
      </Row>
    );
  }
  const q = norm(title);
  const list = ctx.suggestions.filter((s) => !q || norm(s.title).includes(q) || q.includes(norm(s.title))).slice(0, 6);
  if (!list.length) return null;
  return (
    <View style={{ gap: 4 }}>
      <Row gap={4}>
        <Library size={11} color={c.mutedForeground} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5, color: c.mutedForeground }}>DİĞER GRUPLARINDAKİ ESERLER</Text>
      </Row>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {list.map((s) => (
          <Pressable
            key={`${s.groupId}-${s.bookId}`}
            onPress={() => {
              onPick(s.title);
              ctx.setLink(bookId, s);
            }}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: c.card }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: c.foreground }}>
              {s.title} <Text style={{ fontFamily: fonts.regular, color: c.mutedForeground }}>· {s.groupName}</Text>
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
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
