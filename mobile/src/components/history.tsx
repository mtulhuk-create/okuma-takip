import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarRange, Check, CheckCheck, ChevronDown, EyeOff, Flame, Layers, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApiFetch } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import type { GroupHistory, HistoryRange, MyHistory, Stats } from "@/lib/types";
import { Avatar, Card, Muted, Row } from "./ui";

export const RANGE_LABELS: Record<HistoryRange, string> = { "7d": "Son 7 gün", "1m": "Son 1 ay", "3m": "Son 3 ay", "1y": "Son 1 yıl", all: "Üye olduğumdan beri" };
const DOW = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const addDays = (key: string, n: number) => new Date(Date.parse(key) + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (key: string) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

const DOW_MON = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function useCellColor() {
  const c = useColors();
  return (ch: string) => ({ r: c.success, m: "#f59e0b", n: c.destructive, p: "transparent", "-": c.muted, x: c.muted + "66" })[ch] ?? c.muted;
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
export function HistoryGrid({ start, cells }: { start: string; cells: string }) {
  const c = useColors();
  const color = useCellColor();
  const [width, setWidth] = useState(0);
  const todayRing = { borderWidth: 2, borderColor: c.primary + "99" };
  if (cells.length <= 14) {
    return (
      <Row gap={4}>
        {[...cells].map((ch, i) => {
          const key = addDays(start, i);
          const today = i === cells.length - 1;
          const Icon = ch === "r" ? CheckCheck : ch === "m" ? Check : ch === "n" ? X : null;
          return (
            <View key={key} style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: today ? c.primary : c.mutedForeground }}>{DOW[new Date(Date.parse(key)).getUTCDay()]}</Text>
              <View
                style={[
                  { width: "100%", height: 32, borderRadius: 7, backgroundColor: color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground, alignItems: "center", justifyContent: "center" },
                  today && todayRing,
                ]}
              >
                {Icon && <Icon size={14} color="#fff" strokeWidth={3} />}
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
                  { flex: 1, height: 28, borderRadius: 6, backgroundColor: color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground, alignItems: "center", justifyContent: "center" },
                  today && todayRing,
                ]}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "rnm".includes(ch) ? "#fff" : ch === "x" ? c.mutedForeground + "66" : c.mutedForeground }}>{Number(key.slice(8))}</Text>
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
  const cell = Math.min(size, 24);
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
                <View key={key} style={[{ width: size, height: cell, borderRadius: 3, backgroundColor: color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground }, today && todayRing]} />
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

/** Okuma serisi rozeti */
export function StreakBadge({ n, small }: { n: number; small?: boolean }) {
  const c = useColors();
  const on = n > 0;
  const color = on ? "#c2410c" : c.mutedForeground;
  return (
    <Row gap={3} style={{ backgroundColor: on ? "#f9731620" : c.muted, borderRadius: 99, paddingHorizontal: small ? 6 : 10, paddingVertical: small ? 2 : 4 }}>
      <Flame size={small ? 11 : 14} color={color} fill={on ? color : "none"} />
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 10 : 12, color }}>
        {n} gün{small ? "" : " seri"}
      </Text>
    </Row>
  );
}

export function RangePicker({ value, onChange, labels = RANGE_LABELS }: { value: HistoryRange; onChange: (r: HistoryRange) => void; labels?: Record<HistoryRange, string> }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8}>
        <Row gap={4}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.foreground }}>{labels[value]}</Text>
          <ChevronDown size={16} color={c.foreground} />
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

/** Bugün ekranı: yalnızca kullanıcının kendi geçmişi ve serisi */
export function MyHistorySection() {
  const c = useColors();
  const fetcher = useApiFetch();
  const [range, setRange] = useState<HistoryRange>("7d");
  const { data, isFetching } = useQuery({ queryKey: ["/api/m/history", range], queryFn: () => fetcher<MyHistory>(`/api/m/history?range=${range}`), placeholderData: (p) => p });
  if (!data?.groups.length) return null;
  const multi = !!data.all && data.groups.length > 1;
  const streak = (multi ? data.all?.streak : data.groups[0].streak) ?? 0;
  const head = (title: ReactNode, stats: Stats) => (
    <Row style={{ flexWrap: "wrap", justifyContent: "space-between", rowGap: 4 }}>
      {title}
      <StatsLine stats={stats} />
    </Row>
  );
  return (
    <Card style={{ gap: 10, padding: 12, opacity: isFetching ? 0.7 : 1 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ flexShrink: 1 }}>
          <RangePicker value={range} onChange={setRange} />
          <Muted style={{ fontSize: 11 }}>Yalnızca senin okumaların</Muted>
        </View>
        <StreakBadge n={streak} />
      </Row>
      {multi && data.all && (
        <View style={{ gap: 8, backgroundColor: c.muted, borderRadius: 12, padding: 10 }}>
          {head(
            <Row gap={6}>
              <Layers size={14} color={c.primary} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>Tüm gruplar</Text>
            </Row>,
            data.all.stats,
          )}
          <HistoryGrid start={data.all.start} cells={data.all.cells} />
        </View>
      )}
      {data.groups.map((g, i) => (
        <View key={g.group.id} style={{ gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, paddingTop: i ? 10 : 0 }}>
          {head(
            <Row gap={6} style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>
                {g.group.name}
              </Text>
              {multi && <StreakBadge n={g.streak ?? 0} small />}
            </Row>,
            g.stats,
          )}
          <HistoryGrid start={g.start} cells={g.cells} />
        </View>
      ))}
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
                  <Avatar name={r.user.name} uri={r.user.imageUrl} size={28} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>
                    {r.user.name}
                    {r.me ? " (sen)" : ""}
                  </Text>
                </Row>
                <HistoryGrid start={r.start} cells={r.cells} />
                <StatsLine stats={r.stats} />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
