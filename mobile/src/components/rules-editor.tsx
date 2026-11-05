import { CalendarX2, Check, CheckCheck, FileMinus2, Minus, Plus, X } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { fonts, radius, useColors } from "@/lib/theme";
import { penaltyFor, type Rules } from "@/lib/types";
import { Label, Muted, Row, Segmented } from "./ui";

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
    if (next.minPages > next.targetPages) next.minPages = next.targetPages;
    onChange(next);
  };
  const fixed = value.penaltyMode === "FIXED";
  const t = value.targetPages;
  const outcomes = [
    { Icon: CheckCheck, color: c.success, label: `Hedefi okudu (${t}+ sayfa)`, pay: 0 },
    { Icon: Check, color: c.warning, label: `Alt sınırı okudu (${value.minPages})`, pay: penaltyFor(value, value.minPages) },
    { Icon: X, color: c.destructive, label: "Hiç okumadı", pay: penaltyFor(value, 0) },
  ];
  return (
    <View style={{ gap: 18 }}>
      <Step n={1} title="Ceza türü">
        <Segmented
          value={value.penaltyMode}
          onChange={(penaltyMode) => set({ penaltyMode })}
          options={[
            { value: "FIXED", label: "Günlük ceza", hint: "Hedef tutmazsa sabit tutar", icon: CalendarX2 },
            { value: "PER_PAGE", label: "Eksik sayfa başına", hint: "Kalan her sayfa için", icon: FileMinus2 },
          ]}
        />
      </Step>
      <Step n={2} title="Günlük okuma hedefi">
        <Stepper label="Her gün okunacak sayfa" value={t} onChange={(targetPages) => set({ targetPages })} min={1} max={2000} unit="sayfa" presets={[10, 20, 30, 50, 100]} />
      </Step>
      <Step n={3} title="Alt sınır">
        <Stepper
          label="Hedefe ulaşamayanın en az okuması gereken"
          hint={fixed ? "Alt sınırı okuyan indirimli, altında kalan tam ceza öder." : "“Alt sınırı okudum” butonu bu sayıyı bildirir."}
          value={value.minPages}
          onChange={(minPages) => set({ minPages })}
          min={0}
          max={t}
          unit="sayfa"
          presets={[Math.round(t * 0.25), Math.round(t * 0.5), Math.round(t * 0.75)]}
        />
      </Step>
      <Step n={4} title={fixed ? "Günlük ceza" : "Eksik sayfa başına ceza"}>
        <Stepper label={fixed ? "Hedefi tutmayan öder" : "Eksik her sayfa için"} value={value.penaltyAmount} onChange={(penaltyAmount) => set({ penaltyAmount })} min={0} max={100000} step={fixed ? 5 : 1} unit="TL" presets={fixed ? [10, 20, 50, 100] : [1, 2, 5, 10]} />
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
