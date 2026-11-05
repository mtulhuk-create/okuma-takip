import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarRange, Check, CheckCheck, ChevronDown, EyeOff, Layers, X } from "lucide-react-native";
import { useState } from "react";
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

function useCellColor() {
  const c = useColors();
  return (ch: string) => ({ r: c.success, m: "#f59e0b", n: c.destructive, p: "transparent", "-": c.muted })[ch] ?? c.muted;
}

/** Kısa aralıkta gün kutuları, uzun aralıkta haftalık ısı haritası */
export function HistoryGrid({ start, cells }: { start: string; cells: string }) {
  const c = useColors();
  const color = useCellColor();
  if (cells.length <= 14) {
    return (
      <Row gap={4}>
        {[...cells].map((ch, i) => {
          const key = addDays(start, i);
          const Icon = ch === "r" ? CheckCheck : ch === "m" ? Check : ch === "n" ? X : null;
          return (
            <View key={key} style={{ flex: 1, alignItems: "center", gap: 3 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: i === cells.length - 1 ? c.primary : c.mutedForeground }}>{DOW[new Date(Date.parse(key)).getUTCDay()]}</Text>
              <View style={{ width: "100%", maxWidth: 36, aspectRatio: 1, borderRadius: 7, backgroundColor: color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground, alignItems: "center", justifyContent: "center" }}>
                {Icon && <Icon size={14} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>{Number(key.slice(8))}</Text>
            </View>
          );
        })}
      </Row>
    );
  }
  const firstDow = (new Date(Date.parse(start)).getUTCDay() + 6) % 7; // pazartesi başlar
  const padded = "x".repeat(firstDow) + cells;
  const weeks = Array.from({ length: Math.ceil(padded.length / 7) }, (_, w) => padded.slice(w * 7, w * 7 + 7));
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row gap={3} style={{ alignItems: "flex-start" }}>
          {weeks.map((wk, w) => (
            <View key={w} style={{ gap: 3 }}>
              {[...wk].map((ch, d) => (
                <View key={d} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: ch === "x" ? "transparent" : color(ch), borderWidth: ch === "p" ? 1 : 0, borderColor: c.mutedForeground }} />
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
    <Row style={{ flexWrap: "wrap" }} gap={12}>
      {items.map(({ Icon, n, color, label }) => (
        <Row key={label} gap={3}>
          <Icon size={13} color={color} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color }}>{n}</Text>
          <Muted>{label}</Muted>
        </Row>
      ))}
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

/** Bugün ekranı: yalnızca kullanıcının kendi geçmişi */
export function MyHistorySection() {
  const c = useColors();
  const fetcher = useApiFetch();
  const [range, setRange] = useState<HistoryRange>("7d");
  const { data, isFetching } = useQuery({ queryKey: ["/api/m/history", range], queryFn: () => fetcher<MyHistory>(`/api/m/history?range=${range}`), placeholderData: (p) => p });
  if (!data?.groups.length) return null;
  return (
    <Card style={{ gap: 14, opacity: isFetching ? 0.7 : 1 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <RangePicker value={range} onChange={setRange} />
        <Muted>Yalnızca senin okumaların</Muted>
      </Row>
      {data.all && data.groups.length > 1 && (
        <View style={{ gap: 8, backgroundColor: c.muted, borderRadius: 12, padding: 10 }}>
          <Row gap={6}>
            <Layers size={15} color={c.primary} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Tüm gruplar</Text>
          </Row>
          <HistoryGrid start={data.all.start} cells={data.all.cells} />
          <StatsLine stats={data.all.stats} />
        </View>
      )}
      {data.groups.map((g) => (
        <View key={g.group.id} style={{ gap: 8 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>
            {g.group.name}
          </Text>
          <HistoryGrid start={g.start} cells={g.cells} />
          <StatsLine stats={g.stats} />
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
