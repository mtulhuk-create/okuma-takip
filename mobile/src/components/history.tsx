import { useQuery } from "@tanstack/react-query";
import { BookHeart, BookOpen, CalendarRange, Check, CheckCheck, ChevronDown, EyeOff, Flame, Layers, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, useApiFetch } from "@/lib/api";
import { KAZA, type KazaState } from "@/lib/kaza";
import { fonts, STATE, useColors } from "@/lib/theme";
import type { GroupHistory, HistoryRange, MyHistory, Stats } from "@/lib/types";
import { Avatar, Card, Muted, Row, TIER_COLORS, type Tier } from "./ui";

export const RANGE_LABELS: Record<HistoryRange, string> = { "7d": "Son 7 gün", "1m": "Son 1 ay", "3m": "Son 3 ay", "1y": "Son 1 yıl", all: "Üye olduğumdan beri" };
const DOW = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const addDays = (key: string, n: number) => new Date(Date.parse(key) + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (key: string) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

const DOW_MON = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function useCellColor() {
  const c = useColors();
  return (ch: string) => ({ r: STATE.read, k: STATE.kefaret, m: STATE.min, n: STATE.none, p: "transparent", "-": c.muted, x: c.muted + "66" })[ch] ?? c.muted;
}

/** Pazartesi başlayan tam haftalara tamamlanmış gün listesi (x: aralık dışı) */
function weeksOf(start: string, cells: string) {
  const lead = (new Date(Date.parse(start)).getUTCDay() + 6) % 7;
  const total = Math.ceil((lead + cells.length) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const j = i - lead;
    return { key: addDays(start, j), c: j >= 0 && j < cells.length ? cells[j] : "x", today: j === cells.length - 1 };
  });
}

/** Gün durumları kartın genişliğini boşluksuz doldurur: 7 gün şerit, 1 ay takvim, daha uzun aralık haftalık ısı haritası */
/**
 * colorOf / labelOf: başka veri için (kaza geçmişi) hücre rengi ve 7 günlük şeritte hücre içi yazı.
 * Verilmezse okuma durumları (okudu / alt sınır / okumadı) gösterilir.
 */
export function HistoryGrid({
  start,
  cells,
  colorOf,
  labelOf,
  frame,
}: {
  start: string;
  cells: string;
  colorOf?: (ch: string) => string;
  labelOf?: (ch: string, i: number) => string | null;
  /** Ekip çerçevesi (gruba özel) kutucukların çevresinde */
  frame?: Tier | null;
}) {
  const c = useColors();
  // Kutucuklarda yalnızca ince halka: altın biraz kalın, gümüş orta, bronz ince
  const fr = (ch: string, small?: boolean) =>
    frame && ch !== "-" && ch !== "x" ? { borderWidth: small ? 1 : frame === "gold" ? 1.75 : frame === "silver" ? 1.5 : 1, borderColor: TIER_COLORS[frame] } : null;
  const base = useCellColor();
  const color = colorOf ?? base;
  // Koyu hücrede beyaz yazı
  const strong = (ch: string) => (colorOf ? ch >= "3" : "rknm".includes(ch));
  const [width, setWidth] = useState(0);
  const todayRing = { borderWidth: 2, borderColor: c.primary + "99" };
  if (cells.length <= 14) {
    return (
      <Row gap={4}>
        {[...cells].map((ch, i) => {
          const key = addDays(start, i);
          const today = i === cells.length - 1;
          const Icon = ch === "r" ? CheckCheck : ch === "k" ? BookHeart : ch === "m" ? Check : ch === "n" ? X : null;
          return (
            <View key={key} style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: today ? c.primary : c.mutedForeground }}>{DOW[new Date(Date.parse(key)).getUTCDay()]}</Text>
              <View
                style={[
                  { width: "100%", height: 28, borderRadius: 7, backgroundColor: color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground, alignItems: "center", justifyContent: "center" },
                  fr(ch),
                  today && todayRing,
                ]}
              >
                {labelOf ? (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: strong(ch) ? "#fff" : c.mutedForeground }}>{labelOf(ch, i)}</Text>
                ) : (
                  Icon && <Icon size={14} color="#fff" strokeWidth={3} />
                )}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>{Number(key.slice(8))}</Text>
            </View>
          );
        })}
      </Row>
    );
  }

  const days = weeksOf(start, cells);
  const weeks = days.length / 7;

  // ~1 ay: haftalar satır, günler sütun (takvim)
  if (weeks <= 6) {
    return (
      <View style={{ gap: 4 }}>
        <Row gap={4}>
          {DOW_MON.map((d) => (
            <Text key={d} style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 10, color: c.mutedForeground }}>
              {d}
            </Text>
          ))}
        </Row>
        {Array.from({ length: weeks }, (_, w) => (
          <Row key={w} gap={4}>
            {days.slice(w * 7, w * 7 + 7).map(({ key, c: ch, today }) => (
              <View
                key={key}
                style={[
                  { flex: 1, height: 24, borderRadius: 6, backgroundColor: color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground, alignItems: "center", justifyContent: "center" },
                  fr(ch),
                  today && todayRing,
                ]}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: strong(ch) ? "#fff" : ch === "x" ? c.mutedForeground + "66" : c.mutedForeground }}>{Number(key.slice(8))}</Text>
              </View>
            ))}
          </Row>
        ))}
      </View>
    );
  }

  // Uzun aralık: haftalar sütun × günler satır; sütunlar kartı doldurur, sığmazsa yatay kaydırılır
  const GAP = 3;
  const LABEL = 18;
  const size = width ? Math.max(10, Math.floor((width - LABEL - GAP * weeks) / weeks)) : 12;
  const cell = Math.min(size, 20);
  const months = Array.from({ length: weeks }, (_, w) => {
    const first = days.slice(w * 7, w * 7 + 7).find((d) => d.key.endsWith("-01") || (w === 0 && d.c !== "x"));
    return first ? MONTHS[Number(first.key.slice(5, 7)) - 1] : "";
  });
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row gap={GAP} style={{ alignItems: "flex-start" }}>
          <View style={{ width: LABEL - GAP, gap: GAP, paddingTop: 12 + GAP }}>
            {DOW_MON.map((d, i) => (
              <View key={d} style={{ height: cell, justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: c.mutedForeground }}>{i % 2 === 0 ? d : ""}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: weeks }, (_, w) => (
            <View key={w} style={{ gap: GAP, width: size }}>
              <Text numberOfLines={1} style={{ height: 12, width: 40, fontFamily: fonts.regular, fontSize: 9, color: c.mutedForeground }}>
                {months[w]}
              </Text>
              {days.slice(w * 7, w * 7 + 7).map(({ key, c: ch, today }) => (
                <View key={key} style={[{ width: size, height: cell, borderRadius: 3, backgroundColor: color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground }, fr(ch, true), today && todayRing]} />
              ))}
            </View>
          ))}
        </Row>
      </ScrollView>
      <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
        <Muted style={{ fontSize: 10 }}>{fmt(start)}</Muted>
        <Muted style={{ fontSize: 10 }}>{fmt(addDays(start, cells.length - 1))}</Muted>
      </Row>
    </View>
  );
}

export function StatsLine({ stats }: { stats: Stats }) {
  const c = useColors();
  const items = [
    { Icon: CheckCheck, n: stats.read, color: c.success, label: "okudu" },
    { Icon: Check, n: stats.min, color: c.warning, label: "alt sınır" },
    { Icon: X, n: stats.none, color: c.destructive, label: "okumadı" },
    { Icon: BookOpen, n: stats.pages, color: c.mutedForeground, label: "sayfa" },
  ];
  return (
    <Row style={{ flexWrap: "wrap", rowGap: 2 }} gap={10}>
      {items.map(({ Icon, n, color, label }) => (
        <Row key={label} gap={2}>
          <Icon size={12} color={color} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color }}>{n}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>{label}</Text>
        </Row>
      ))}
    </Row>
  );
}

/** Seri en az 3 günden başlar */
export const STREAK_MIN = 3;
const STREAK_TONE = {
  normal: { fg: "#c2410c", bg: "#fff7ed", border: "#fb923c" },
  full: { fg: "#047857", bg: "#ecfdf5", border: "#10b981" },
  kaza: { fg: KAZA, bg: "#eef2ff", border: "#818cf8" },
} as const;

/**
 * Okuma serisi rozeti (3 gün ve üstü). Tam seri (üst üste hedef) yeşil, alt sınır dahil seri turuncu.
 * sticker: kartın sağ üst kenarına hafif eğik yapışık durur.
 */
export function StreakBadge({ n, full, small, sticker, kaza }: { n: number; full?: boolean; small?: boolean; sticker?: boolean; kaza?: boolean }) {
  if (n < STREAK_MIN) return null;
  const t = STREAK_TONE[kaza ? "kaza" : full ? "full" : "normal"];
  return (
    <Row
      gap={3}
      style={[
        { backgroundColor: t.bg, borderRadius: 99, paddingHorizontal: small ? 7 : 10, paddingVertical: small ? 2 : 4, borderWidth: 1, borderColor: t.border },
        sticker && { position: "absolute", top: -11, right: 12, transform: [{ rotate: "5deg" }], elevation: 3, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, zIndex: 2 },
      ]}
    >
      <Flame size={small ? 11 : 14} color={t.fg} fill={t.fg} />
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 10 : 12, color: t.fg }}>
        {n} gün {full ? "tam seri" : "seri"}
      </Text>
    </Row>
  );
}

/** İsmin yanında küçük seri işareti (sohbet ve üye listesi): alev ve gün sayısı */
export function StreakChip({ s }: { s?: { n: number; full: boolean } | null }) {
  if (!s || s.n < STREAK_MIN) return null;
  const t = STREAK_TONE[s.full ? "full" : "normal"];
  return (
    <Row gap={1} style={{ backgroundColor: t.bg, borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: t.border + "88", flexShrink: 0 }}>
      <Flame size={9} color={t.fg} fill={t.fg} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: t.fg }}>{s.n}</Text>
    </Row>
  );
}

export function RangePicker({ value, onChange, labels = RANGE_LABELS, small }: { value: HistoryRange; onChange: (r: HistoryRange) => void; labels?: Record<HistoryRange, string>; small?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8}>
        <Row gap={3}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: small ? 12 : 14, color: c.foreground }}>
            {labels[value]}
          </Text>
          <ChevronDown size={small ? 13 : 16} color={c.foreground} />
        </Row>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "#0005", justifyContent: "center", padding: 32 }}>
          <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 6 }}>
            {(Object.keys(labels) as HistoryRange[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  onChange(r);
                  setOpen(false);
                }}
                style={({ pressed }) => [{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 10, backgroundColor: pressed ? c.muted : "transparent" }]}
              >
                <Text style={{ fontFamily: r === value ? fonts.bold : fonts.regular, fontSize: 15, color: r === value ? c.primary : c.foreground }}>{labels[r]}</Text>
                {r === value && <Check size={18} color={c.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Açılır seçim (grup seçimi) */
function GroupPicker({ value, options, onChange, small }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; small?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.muted, borderRadius: 7, paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 3 : 4 }}>
        <Layers size={small ? 11 : 13} color={c.primary} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: small ? 11 : 12, color: c.foreground }}>
          {current?.label}
        </Text>
        <ChevronDown size={small ? 12 : 14} color={c.foreground} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "#0005", justifyContent: "center", padding: 32 }}>
          <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 6, maxHeight: "70%" }}>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 10, backgroundColor: pressed ? c.muted : "transparent" }]}
                >
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: o.value === value ? fonts.bold : fonts.regular, fontSize: 15, color: o.value === value ? c.primary : c.foreground }}>
                    {o.label}
                  </Text>
                  {o.value === value && <Check size={18} color={c.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Bugün ekranı: kendi okuma geçmişin. Varsayılan tüm gruplar; menüden tek grup seçilebilir. */
type KazaHistory = { start: string; counts: number[]; total: number; days: number };
/** Günlük net kaza → ısı haritası seviyesi: 1–5 arası her sayı ayrı ton, 6 ve üstü en koyu */
const kazaLevel = (n: number) => String(Math.max(0, Math.min(6, n)));
/** Mor tonları: en belirgin fark 1 ile 5 arasında */
const KAZA_TONES: Record<string, string> = { "1": KAZA + "33", "2": KAZA + "59", "3": KAZA + "80", "4": KAZA + "a6", "5": KAZA + "d1", "6": KAZA };

/** Okuma / Kaza seçimi (geçmiş kutusunun başında) */
function ModeSwitch({ value, onChange }: { value: "read" | "kaza"; onChange: (v: "read" | "kaza") => void }) {
  const c = useColors();
  return (
    <Row gap={0} style={{ backgroundColor: c.muted, borderRadius: 99, padding: 2 }}>
      {(
        [
          ["read", "Okuma"],
          ["kaza", "Kaza"],
        ] as const
      ).map(([v, label]) => {
        const on = value === v;
        return (
          <Pressable key={v} onPress={() => onChange(v)} hitSlop={4} style={{ paddingHorizontal: 9, height: 22, justifyContent: "center", borderRadius: 99, backgroundColor: on ? c.card : "transparent", elevation: on ? 1 : 0 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: on ? (v === "kaza" ? KAZA : c.primary) : c.mutedForeground }}>{label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Bugün sayfasının başındaki geçmiş kutusu: okuma (varsayılan) ya da kaza takibi açıksa kaza geçmişi */
export function MyHistorySection() {
  const c = useColors();
  const fetcher = useApiFetch();
  const [range, setRange] = useState<HistoryRange>("7d");
  const [sel, setSel] = useState("all");
  const [mode, setMode] = useState<"read" | "kaza">("read");
  const { data, isFetching } = useQuery({ queryKey: ["/api/m/history", range], queryFn: () => fetcher<MyHistory>(`/api/m/history?range=${range}`), placeholderData: (p) => p });
  const kaza = useApi<KazaState>("/api/m/kaza");
  const kazaOn = !!kaza.data?.enabled;
  const hasRead = !!data?.groups.length;
  const view = !hasRead ? "kaza" : kazaOn ? mode : "read";
  const kh = useQuery({
    queryKey: ["/api/m/kaza/history", range],
    queryFn: () => fetcher<KazaHistory>(`/api/m/kaza/history?range=${range}`),
    enabled: kazaOn && view === "kaza",
    placeholderData: (p) => p,
  });
  if (!hasRead && !kazaOn) return null;
  const multi = !!data?.all && (data?.groups.length ?? 0) > 1;
  const group = data?.groups.find((g) => g.group.id === sel);
  const combined = (sel === "all" || !group) && multi;
  const row = data && hasRead ? (combined ? data.all! : (group ?? data.groups[0])) : null;
  // Seri ve ekip çerçevesi gruba özel: "Tüm gruplar" birleşiminde gösterilmez
  const groupRow = row && !combined ? (row as { tier?: Tier | null }) : null;
  const k = kh.data;
  return (
    <Card style={{ gap: 8, padding: 10, opacity: (view === "read" ? isFetching : kh.isFetching) ? 0.7 : 1 }}>
      <Row gap={6}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <RangePicker value={range} onChange={setRange} small />
        </View>
        {kazaOn && hasRead && <ModeSwitch value={mode} onChange={setMode} />}
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}>
          {view === "read" && row ? (
            multi ? (
              <GroupPicker value={group ? sel : "all"} onChange={setSel} small options={[{ value: "all", label: "Tüm gruplar" }, ...data!.groups.map((g) => ({ value: g.group.id, label: g.group.name }))]} />
            ) : (
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, color: c.mutedForeground }}>
                {data!.groups[0].group.name}
              </Text>
            )
          ) : (
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, color: KAZA }}>
              Namaz kaza
            </Text>
          )}
        </View>
      </Row>
      {view === "read" && row ? (
        <>
          <HistoryGrid start={row.start} cells={row.cells} frame={groupRow?.tier} />
          <StatsLine stats={row.stats} />
        </>
      ) : k ? (
        <>
          <HistoryGrid
            start={k.start}
            cells={k.counts.map(kazaLevel).join("")}
            colorOf={(ch) => KAZA_TONES[ch] ?? c.muted}
            labelOf={(_ch, i) => (k.counts[i] ? String(k.counts[i]) : null)}
          />
          <Row gap={10} style={{ flexWrap: "wrap", rowGap: 2 }}>
            {[
              { n: k.total, label: "kaza kılındı", color: KAZA },
              { n: k.days, label: "gün", color: c.foreground },
              { n: k.days ? Math.round((k.total / k.counts.length) * 10) / 10 : 0, label: "günlük ort.", color: c.foreground },
            ].map((x) => (
              <Row key={x.label} gap={3}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: x.color }}>{x.n.toLocaleString("tr-TR")}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>{x.label}</Text>
              </Row>
            ))}
          </Row>
        </>
      ) : (
        <ActivityIndicator size="small" color={KAZA} />
      )}
      {/* Seri rozeti: kartın sağ üst kenarında, hafif eğik */}
      {/* Tam seri (üst üste hedef) öncelikli; yoksa alt sınır dahil seri */}
      {view === "read" && row && groupRow ? (row.fullStreak ?? 0) >= STREAK_MIN ? <StreakBadge n={row.fullStreak!} full small sticker /> : <StreakBadge n={row.streak ?? 0} small sticker /> : null}
      {view === "kaza" && <StreakBadge n={kaza.data?.streak ?? 0} small sticker kaza />}
    </Card>
  );
}

/** Sohbetten açılan grup okuma geçmişi (alttan açılan pencere) */
export function GroupHistoryModal({ groupId, visible, onClose }: { groupId: string; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const fetcher = useApiFetch();
  const [range, setRange] = useState<HistoryRange>("7d");
  const { data, isFetching } = useQuery({ queryKey: [`/api/m/groups/${groupId}/history`, range], queryFn: () => fetcher<GroupHistory>(`/api/m/groups/${groupId}/history?range=${range}`), enabled: visible, placeholderData: (p) => p });
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0006" }}>
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", paddingBottom: insets.bottom + 8 }}>
          <Row style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <CalendarRange size={20} color={c.primary} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: c.foreground }}>Okuma geçmişi</Text>
            {isFetching && <ActivityIndicator size="small" color={c.primary} />}
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={c.mutedForeground} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <RangePicker value={range} onChange={setRange} labels={{ ...RANGE_LABELS, all: "Grup kurulduğundan beri" }} />
            {data?.limited && (
              <Row style={{ alignItems: "flex-start", backgroundColor: c.muted, borderRadius: 10, padding: 10 }}>
                <EyeOff size={15} color={c.mutedForeground} />
                <Muted style={{ flex: 1 }}>Diğer üyelerin geçmişini görmek için yöneticinin “Okuyucular birbirinin geçmişini görsün” ayarını açması gerekir.</Muted>
              </Row>
            )}
            {data?.rows.map((r) => (
              <View key={r.user.id} style={{ gap: 8 }}>
                <Row>
                  <Avatar name={r.user.name} uri={r.user.imageUrl} initial={r.user.initial} seed={r.user.id} size={28} frame={r.tier} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>
                    {r.user.name}
                    {r.me ? " (sen)" : ""}
                  </Text>
                  {/* Seri bu grubun okumalarından */}
                  <StreakChip s={r.streak} />
                </Row>
                <HistoryGrid start={r.start} cells={r.cells} frame={r.tier} />
                <StatsLine stats={r.stats} />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
