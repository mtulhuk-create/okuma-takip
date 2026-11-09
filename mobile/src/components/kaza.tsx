import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, RotateCcw } from "lucide-react-native";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useApi, useApiFetch } from "@/lib/api";
import { KAZA, PRAYER_INFO, PRAYERS, syncKazaCard, type Counts, type KazaState, type Prayer } from "@/lib/kaza";
import { fonts, useColors } from "@/lib/theme";
import { Row } from "./ui";

export const KAZA_PATH = "/api/m/kaza";
export type KazaOp =
  | { op: "enable"; on: boolean }
  | { op: "make" | "undo" | "add" | "unadd"; prayer: Prayer }
  | { op: "set"; counts: Partial<Counts>; mode: "replace" | "add" }
  | { op: "goal"; goal: number };

export const fmt = (n: number) => n.toLocaleString("tr-TR");

// Son işlem (geri alınabilir): sayfa ve Bugün kartı aynı bilgiyi gösterir
type Last = { op: "make" | "add"; prayer: Prayer; at: number } | null;
let last: Last = null;
const subs = new Set<() => void>();
const setLast = (v: Last) => {
  last = v;
  subs.forEach((f) => f());
};
const useLast = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => last,
  );

/** Kaza durumu ve işlemleri; kıldım / kaçırdım anında ekrana yansır, sunucu yanıtı kesinleştirir */
export function useKaza() {
  const q = useApi<KazaState>(KAZA_PATH);
  const fetcher = useApiFetch();
  const qc = useQueryClient();
  const op = useMutation({
    mutationFn: (body: KazaOp) => fetcher<KazaState>(KAZA_PATH, { method: "POST", body: JSON.stringify(body) }),
    onMutate: async (body) => {
      if (body.op === "enable" || body.op === "set" || body.op === "goal") return;
      await qc.cancelQueries({ queryKey: [KAZA_PATH] });
      const prev = qc.getQueryData<KazaState>([KAZA_PATH]);
      if (prev) {
        const p = body.prayer;
        // kalan / kılınan / bugün değişimi
        const d = { make: [-1, 1, 1], undo: [1, -1, -1], add: [1, 0, 0], unadd: [-1, 0, 0] }[body.op];
        qc.setQueryData<KazaState>([KAZA_PATH], {
          ...prev,
          remaining: { ...prev.remaining, [p]: Math.max(0, prev.remaining[p] + d[0]) },
          made: { ...prev.made, [p]: Math.max(0, prev.made[p] + d[1]) },
          today: Math.max(0, prev.today + d[2]),
        });
      }
      return { prev };
    },
    onError: (e, _b, ctx) => {
      if (ctx?.prev) qc.setQueryData([KAZA_PATH], ctx.prev);
      Alert.alert("İşlem yapılamadı", e.message);
    },
    onSuccess: (s, body) => {
      // Token yalnızca GET'te gelir; korunur
      qc.setQueryData<KazaState>([KAZA_PATH], (old) => ({ ...s, token: old?.token }));
      qc.invalidateQueries({ queryKey: ["/api/m/kaza/history"] });
      if (body.op === "make" || body.op === "add") setLast({ op: body.op, prayer: body.prayer, at: Date.now() });
      else if (body.op === "undo" || body.op === "unadd") setLast(null);
    },
  });
  // Bildirim panelindeki kaza kartı uygulamadaki sayılarla aynı kalsın
  useEffect(() => {
    syncKazaCard(q.data).catch(() => {});
  }, [q.data]);
  return { ...q, op };
}

/** Minimal − / + adımlayıcı: − kıldım (vaktin renginde), + kaçırdım */
function Stepper({ color, label, left, op, prayer, h = 26 }: { color: string; label: string; left: number; op: ReturnType<typeof useKaza>["op"]; prayer: Prayer; h?: number }) {
  const c = useColors();
  const half = (kind: "make" | "add") => (
    <Pressable
      disabled={kind === "make" && !left}
      accessibilityLabel={kind === "make" ? `${label} kazası kıldım` : `${label} namazını kaçırdım, kazaya ekle`}
      onPress={() => op.mutate({ op: kind, prayer })}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => ({ flex: 1, height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: pressed ? (kind === "make" ? color + "33" : c.muted) : "transparent", opacity: kind === "make" && !left ? 0.3 : 1 })}
    >
      {kind === "make" ? <Minus size={13} color={color} strokeWidth={2.8} /> : <Plus size={13} color={c.mutedForeground} strokeWidth={2.8} />}
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", height: h, borderRadius: h / 2, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
      {half("make")}
      <View style={{ width: 1, backgroundColor: c.border }} />
      {half("add")}
    </View>
  );
}

/** Bugün kartı: altı vakit tek sırada; ad, kalan ve − / + */
export function PrayerStrip({ s, op }: { s: KazaState; op: ReturnType<typeof useKaza>["op"] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {PRAYERS.map((p) => {
        const { label, color } = PRAYER_INFO[p];
        return (
          <View key={p} style={{ flex: 1, alignItems: "center", gap: 3 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 10, color }}>
              {label}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 19, color: c.foreground }}>
              {fmt(s.remaining[p])}
            </Text>
            <View style={{ alignSelf: "stretch" }}>
              <Stepper color={color} label={label} left={s.remaining[p]} op={op} prayer={p} h={24} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Kaza sayfası: üçerli iki sıra; simge ve ad, kalan, − / + */
export function PrayerGrid({ s, op }: { s: KazaState; op: ReturnType<typeof useKaza>["op"] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {PRAYERS.map((p) => {
        const { label, Icon, color } = PRAYER_INFO[p];
        return (
          <View key={p} style={{ width: "31.5%", flexGrow: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
            <Row gap={4}>
              <Icon size={13} color={color} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 11, color: c.mutedForeground }}>
                {label}
              </Text>
            </Row>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: c.foreground }}>
              {fmt(s.remaining[p])}
            </Text>
            <Stepper color={color} label={label} left={s.remaining[p]} op={op} prayer={p} />
          </View>
        );
      })}
    </View>
  );
}

/** Son işlemi geri al (birkaç saniye görünür) */
export function UndoBar({ op }: { op: ReturnType<typeof useKaza>["op"] }) {
  const c = useColors();
  const l = useLast();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!l) return;
    const t = setTimeout(() => tick((n) => n + 1), 8000);
    return () => clearTimeout(t);
  }, [l]);
  // eslint-disable-next-line react-hooks/purity -- görünürlük son işlemin üzerinden geçen süreye bağlı
  if (!l || Date.now() - l.at > 8000) return null;
  const { label, color } = PRAYER_INFO[l.prayer];
  return (
    <Row gap={8} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: c.muted }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: c.foreground }}>
        {label} {l.op === "make" ? "kazası kılındı" : "kazaya eklendi"}
      </Text>
      <Pressable hitSlop={8} onPress={() => op.mutate({ op: l.op === "make" ? "undo" : "unadd", prayer: l.prayer })}>
        <Row gap={4}>
          <RotateCcw size={13} color={KAZA} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: KAZA }}>Geri al</Text>
        </Row>
      </Pressable>
    </Row>
  );
}

/** Son 7 gün, 1 ay, 3 ay ve 1 yılda kılınan kaza (minimal tablo) */
export function StatsTable({ s, compact }: { s: KazaState; compact?: boolean }) {
  const c = useColors();
  const p = s.periods;
  const cols: { key: keyof NonNullable<KazaState["periods"]>; label: string }[] = [
    { key: "d7", label: "7 gün" },
    { key: "m1", label: "1 ay" },
    { key: "m3", label: "3 ay" },
    { key: "y1", label: "1 yıl" },
  ];
  return (
    <View style={{ flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
      {cols.map((col, i) => {
        const v = p?.[col.key];
        return (
          <View key={col.key} style={{ flex: 1, alignItems: "center", paddingVertical: compact ? 7 : 10, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: c.mutedForeground }}>{col.label}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: compact ? 15 : 17, color: c.foreground }}>{v ? fmt(v.count) : "–"}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 9.5, color: c.mutedForeground }}>{v ? `${v.days} gün` : ""}</Text>
          </View>
        );
      })}
    </View>
  );
}
