import { BookPicker, BookSuggestions, useAutoLink } from "./book-match";
import { BookOpen, CalendarX2, Check, CheckCheck, Clock, FileMinus2, Minus, Plus, Trash2, X } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { fonts, radius, useColors } from "@/lib/theme";
import { formatAmount, formatMinutes, penaltyFor, type Book, type ReadUnit, type Rules } from "@/lib/types";
import { Button, Label, Muted, Row, Segmented } from "./ui";

export function Stepper({ label, hint, value, onChange, min, max, step = 1, unit, presets }: { label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit: string; presets: number[] }) {
  const c = useColors();
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));
  const btn = (Icon: typeof Plus, d: number, a11y: string) => (
    <Pressable accessibilityLabel={a11y} onPress={() => onChange(clamp(value + d))} style={({ pressed }) => [{ width: 46, height: 46, borderRadius: radius + 2, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
      <Icon size={18} color={c.foreground} />
    </Pressable>
  );
  return (
    <View>
      <Label>{label}</Label>
      <Row>
        {btn(Minus, -step, "Azalt")}
        <View style={{ flex: 1, height: 46, borderRadius: radius + 2, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <TextInput
            value={String(value)}
            onChangeText={(t) => onChange(clamp(Number(t.replace(/\D/g, "")) || 0))}
            keyboardType="number-pad"
            style={{ fontFamily: fonts.bold, fontSize: 22, color: c.foreground, minWidth: 50, textAlign: "center", padding: 0 }}
          />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: c.mutedForeground }}>{unit}</Text>
        </View>
        {btn(Plus, step, "Artır")}
      </Row>
      <Row style={{ flexWrap: "wrap", marginTop: 8 }} gap={6}>
        {[...new Set(presets.map(clamp))].map((p) => (
          <Pressable key={p} onPress={() => onChange(p)} style={{ borderRadius: 99, borderWidth: 1, borderColor: p === value ? c.primary : c.border, backgroundColor: p === value ? c.primary : c.card, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: p === value ? c.primaryForeground : c.foreground }}>{p}</Text>
          </Pressable>
        ))}
      </Row>
      {hint && <Muted style={{ marginTop: 6 }}>{hint}</Muted>}
    </View>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const c = useColors();
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));
  return (
    <View style={{ flex: 1 }}>
      <Muted style={{ marginBottom: 4, fontFamily: fonts.semibold }}>{label}</Muted>
      <Row gap={0} style={{ height: 42, borderWidth: 1, borderColor: c.border, borderRadius: radius + 2, backgroundColor: c.card }}>
        <Pressable onPress={() => onChange(clamp(value - 1))} style={{ width: 36, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Minus size={16} color={c.mutedForeground} />
        </Pressable>
        <TextInput value={String(value)} onChangeText={(t) => onChange(clamp(Number(t.replace(/\D/g, "")) || 0))} keyboardType="number-pad" style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 16, color: c.foreground, padding: 0 }} />
        <Pressable onPress={() => onChange(clamp(value + 1))} style={{ width: 36, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Plus size={16} color={c.mutedForeground} />
        </Pressable>
      </Row>
    </View>
  );
}

/** Saat hesabında süre: 15 dakikalık adımlarla artır / azalt */
function DurationField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const c = useColors();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <View style={{ flex: 1 }}>
      <Muted style={{ marginBottom: 4, fontFamily: fonts.semibold }}>{label}</Muted>
      <Row gap={0} style={{ height: 42, borderWidth: 1, borderColor: c.border, borderRadius: radius + 2, backgroundColor: c.card }}>
        <Pressable onPress={() => onChange(clamp(value - 15))} accessibilityLabel={`${label} azalt`} style={{ width: 36, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Minus size={16} color={c.mutedForeground} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>{value === 0 ? "Yok" : formatMinutes(value)}</Text>
        <Pressable onPress={() => onChange(clamp(value + 15))} accessibilityLabel={`${label} artır`} style={{ width: 36, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Plus size={16} color={c.mutedForeground} />
        </Pressable>
      </Row>
    </View>
  );
}

/** Hesap değişince eserlerin hedefleri yeni birimin varsayılanlarına döner */
const unitDefaults = (unit: ReadUnit) => (unit === "MINUTES" ? { targetPages: 60, minPages: 30 } : { targetPages: 20, minPages: 10 });

const newBook = (): Book => ({ id: Math.random().toString(36).slice(2, 10), title: "", targetPages: 20, minPages: 10 });

function BooksEditor({ books, unit, onChange }: { books: Book[]; unit: ReadUnit; onChange: (b: Book[]) => void }) {
  const c = useColors();
  const autoLink = useAutoLink();
  const update = (id: string, patch: Partial<Book>) =>
    onChange(books.map((b) => (b.id === id ? (() => { const n = { ...b, ...patch }; if (n.minPages > n.targetPages) n.minPages = n.targetPages; return n; })() : b)));
  return (
    <View style={{ gap: 8 }}>
      {books.map((b, i) => (
        <View key={b.id} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, gap: 8 }}>
          <Row>
            <BookOpen size={16} color={c.primary} />
            {/* Yalnızca katalogdaki eserler seçilebilir */}
            <BookPicker
              value={b.title}
              onChange={(title) => {
                autoLink(b.id, title);
                update(b.id, { title });
              }}
            />
            {books.length > 1 && (
              <Pressable
                onPress={() => {
                  autoLink(b.id, "");
                  onChange(books.filter((x) => x.id !== b.id));
                }}
                hitSlop={8}
              >
                <Trash2 size={18} color={c.mutedForeground} />
              </Pressable>
            )}
          </Row>
          <BookSuggestions bookId={b.id} title={b.title} />
          <Row>
            {unit === "MINUTES" ? (
              <>
                <DurationField label="Günlük hedef" value={b.targetPages} onChange={(targetPages) => update(b.id, { targetPages })} min={15} max={600} />
                <DurationField label="Alt sınır" value={b.minPages} onChange={(minPages) => update(b.id, { minPages })} min={0} max={b.targetPages} />
              </>
            ) : (
              <>
                <NumberField label="Günlük hedef (sayfa)" value={b.targetPages} onChange={(targetPages) => update(b.id, { targetPages })} min={1} max={2000} />
                <NumberField label="Alt sınır (sayfa)" value={b.minPages} onChange={(minPages) => update(b.id, { minPages })} min={0} max={b.targetPages} />
              </>
            )}
          </Row>
        </View>
      ))}
      {books.length < 10 && <Button title="Eser ekle" icon={Plus} small variant="ghost" style={{ alignSelf: "flex-start" }} onPress={() => onChange([...books, { ...newBook(), ...unitDefaults(unit) }])} />}
    </View>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.primaryForeground }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

export function RulesEditor({ value, onChange }: { value: Rules; onChange: (r: Rules) => void }) {
  const c = useColors();
  const set = (patch: Partial<Rules>) => {
    const next = { ...value, ...patch };
    next.targetPages = next.books.reduce((s, b) => s + b.targetPages, 0);
    next.minPages = next.books.reduce((s, b) => s + b.minPages, 0);
    onChange(next);
  };
  const fixed = value.penaltyMode === "FIXED";
  const unit: ReadUnit = value.readUnit ?? "PAGES";
  const minutes = unit === "MINUTES";
  const f = (n: number) => formatAmount(n, unit, true);
  const t = value.targetPages;
  const outcomes = [
    { Icon: CheckCheck, color: c.success, label: `Hedefi okudu (${f(t)}${minutes ? " ya da fazlası" : "+"})`, pay: 0 },
    { Icon: Check, color: c.warning, label: `Alt sınırı okudu (${f(value.minPages)})`, pay: penaltyFor(value, value.minPages) },
    { Icon: X, color: c.destructive, label: "Hiç okumadı", pay: penaltyFor(value, 0) },
  ];
  return (
    <View style={{ gap: 18 }}>
      <Step n={1} title="Okuma hesabı">
        <Segmented
          value={unit}
          onChange={(readUnit) => readUnit !== unit && set({ readUnit, books: value.books.map((b) => ({ ...b, ...unitDefaults(readUnit) })) })}
          options={[
            { value: "PAGES", label: "Sayfa hesabı", hint: "Hedef sayfa olarak", icon: BookOpen },
            { value: "MINUTES", label: "Saat hesabı", hint: "Hedef süre (15 dk adım)", icon: Clock },
          ]}
        />
      </Step>
      <Step n={2} title="Ceza türü">
        <Segmented
          value={value.penaltyMode}
          onChange={(penaltyMode) => set({ penaltyMode })}
          options={[
            { value: "FIXED", label: "Günlük ceza", hint: "Hedef tutmazsa sabit tutar", icon: CalendarX2 },
            { value: "PER_PAGE", label: minutes ? "Eksik süre başına" : "Eksik sayfa başına", hint: minutes ? "Kalan her 15 dk için" : "Kalan her sayfa için", icon: FileMinus2 },
          ]}
        />
      </Step>
      <Step n={3} title="Okunacak eserler">
        <BooksEditor books={value.books} unit={unit} onChange={(books) => set({ books })} />
        <Muted>
          Günlük toplam: hedef {f(t)} · alt sınır {f(value.minPages)}. {fixed ? "Alt sınırı okuyan indirimli, altında kalan tam ceza öder." : minutes ? "Hedefe eksik kalan her 15 dakika için ceza yazılır." : "Hedefe eksik kalan her sayfa için ceza yazılır."}
        </Muted>
      </Step>
      <Step n={4} title={fixed ? "Günlük ceza" : minutes ? "Eksik 15 dakika başına ceza" : "Eksik sayfa başına ceza"}>
        <Stepper label={fixed ? "Hedefi tutmayan öder" : minutes ? "Eksik her 15 dakika için" : "Eksik her sayfa için"} value={value.penaltyAmount} onChange={(penaltyAmount) => set({ penaltyAmount })} min={0} max={100000} step={fixed ? 5 : 1} unit="TL" presets={fixed ? [10, 20, 50, 100] : [1, 2, 5, 10]} />
      </Step>
      {fixed && (
        <Step n={5} title="Alt sınırı okuyana indirim">
          <Stepper label="Cezadan indirim" value={value.minDiscount} onChange={(minDiscount) => set({ minDiscount })} min={0} max={100} step={5} unit="%" presets={[0, 25, 50, 75]} />
        </Step>
      )}
      <View style={{ borderRadius: radius + 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted, padding: 12, gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.mutedForeground }}>Bir günde kim ne öder?</Text>
        {outcomes.map(({ Icon, color, label, pay }) => (
          <Row key={label} gap={10}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
              <Icon size={15} color={color} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.foreground }}>{label}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pay ? c.destructive : c.success }}>{pay ? `${pay} TL` : "Ceza yok"}</Text>
          </Row>
        ))}
      </View>
    </View>
  );
}
