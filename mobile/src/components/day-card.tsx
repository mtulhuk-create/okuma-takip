import { router } from "expo-router";
import { BookOpen, Check, CheckCheck, ChevronRight, Clock, Lock, X, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAction } from "@/lib/api";
import { formatDayLong, formatClock } from "@/lib/format";
import { fonts, radius, useColors } from "@/lib/theme";
import type { DayCard as Card, DayPerson } from "@/lib/types";
import { Countdown } from "./countdown";
import { Avatar, Body, Muted, Row } from "./ui";

type Cat = { key: "read" | "min" | "none" | "pending"; label: string; Icon: LucideIcon; color: (c: ReturnType<typeof useColors>) => string };
const CATS: Cat[] = [
  { key: "read", label: "Okudu", Icon: CheckCheck, color: (c) => c.success },
  { key: "min", label: "Alt sınır", Icon: Check, color: (c) => c.warning },
  { key: "none", label: "Okumadı", Icon: X, color: (c) => c.destructive },
  { key: "pending", label: "Bekleniyor", Icon: Clock, color: (c) => c.mutedForeground },
];

export function AvatarStack({ people, size = 26, max = 5 }: { people: { id: string; name: string; imageUrl: string | null }[]; size?: number; max?: number }) {
  const c = useColors();
  const rest = people.length - max;
  return (
    <View style={{ flexDirection: "row" }}>
      {people.slice(0, max).map((p, i) => (
        <View key={p.id} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: c.card, borderRadius: size }}>
          <Avatar name={p.name} uri={p.imageUrl} size={size} />
        </View>
      ))}
      {rest > 0 && (
        <View style={{ marginLeft: -8, width: size + 4, height: size + 4, borderRadius: size, backgroundColor: c.muted, borderWidth: 2, borderColor: c.card, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.mutedForeground }}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

type BookChoice = "read" | "min" | "none";
function bookState(b: { pages: number | null; target: number; min: number }): BookChoice | "partial" | null {
  if (b.pages == null) return null;
  if (b.pages >= b.target) return "read";
  if (b.pages === 0) return "none";
  return b.pages >= b.min ? "min" : "partial";
}

/** Eser satırları (sağda ikonlu butonlar) + altta yan yana tümü için butonlar */
export function ReportControls({ groupId, card, compact, onDone }: { groupId: string; card: Card; compact?: boolean; onDone?: () => void }) {
  const c = useColors();
  const action = useAction();
  const me = card.me!;
  const single = me.books.length === 1;
  const busy = (key: string) => action.isPending && action.variables?.body?.key === key;
  const send = (body: Record<string, unknown>, key: string) => action.mutate({ name: "reportReading", body: { groupId, ...body, key } }, { onSuccess: () => onDone?.() });
  const BTNS: { key: BookChoice; Icon: LucideIcon; color: string }[] = [
    { key: "read", Icon: CheckCheck, color: c.success },
    { key: "min", Icon: Check, color: c.warning },
    { key: "none", Icon: X, color: c.destructive },
  ];
  const total = me.pages ?? 0;
  const status = me.pages == null ? null : total >= me.target ? "Hedef tamam" : total >= me.min ? "Alt sınır tamam" : "Alt sınırın altında";
  const bottom: { key: string; label: string; Icon: LucideIcon; variant: "success" | "primary" | "ghost"; body: Record<string, unknown> }[] = [
    { key: "all", label: single ? "Okudum" : "Hepsini okudum", Icon: CheckCheck, variant: "success", body: { choice: "all" } },
    { key: "min", label: "Alt sınırı okudum", Icon: Check, variant: "primary", body: { choice: "min" } },
    { key: "none", label: "Okuyamadım", Icon: X, variant: "ghost", body: { choice: "none" } },
  ];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12 }}>
        {me.books.map((b, i) => {
          const st = bookState(b);
          return (
            <Row key={b.id} style={{ paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <BookOpen size={16} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>
                  {b.title}
                </Text>
                <Muted>
                  Hedef {b.target} · alt sınır {b.min}
                  {b.pages != null ? ` · ${b.pages} sf` : ""}
                </Muted>
              </View>
              {BTNS.map(({ key, Icon, color }) => {
                const on = st === key;
                const k = `${b.id}-${key}`;
                return (
                  <Pressable
                    key={key}
                    accessibilityLabel={`${b.title}: ${key === "read" ? "Okudum" : key === "min" ? "Alt sınırı okudum" : "Okumadım"}`}
                    disabled={action.isPending}
                    onPress={() => send({ bookId: b.id, bookChoice: key }, k)}
                    style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: on ? color : c.border, backgroundColor: on ? color : c.card, alignItems: "center", justifyContent: "center" }}
                  >
                    {busy(k) ? <ActivityIndicator size="small" color={on ? "#fff" : color} /> : <Icon size={16} color={on ? "#fff" : c.mutedForeground} strokeWidth={2.6} />}
                  </Pressable>
                );
              })}
            </Row>
          );
        })}
      </View>
      <Row gap={6}>
        {bottom.map((b) => (
          <Pressable
            key={b.key}
            disabled={action.isPending}
            onPress={() => send(b.body, b.key)}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: compact ? 50 : 56,
                borderRadius: radius + 2,
                borderWidth: 1,
                borderColor: b.variant === "ghost" ? c.border : "transparent",
                backgroundColor: b.variant === "success" ? c.success : b.variant === "primary" ? c.primary : c.card,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                paddingHorizontal: 4,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {busy(b.key) ? (
              <ActivityIndicator size="small" color={b.variant === "ghost" ? c.foreground : "#fff"} />
            ) : (
              <>
                <b.Icon size={16} color={b.variant === "ghost" ? c.foreground : "#fff"} />
                <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 11, textAlign: "center", color: b.variant === "ghost" ? c.foreground : "#fff" }}>
                  {b.label}
                </Text>
              </>
            )}
          </Pressable>
        ))}
      </Row>
      {status && (
        <Muted style={{ textAlign: "center" }}>
          Bugün {total}/{me.target} sayfa · {status}
        </Muted>
      )}
    </View>
  );
}

function CategoryRow({ cat, people }: { cat: Cat; people: DayPerson[] }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  if (!people.length) return null;
  const color = cat.color(c);
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 }]}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color + "1f", alignItems: "center", justifyContent: "center" }}>
          <cat.Icon size={16} color={color} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>
          {cat.label} <Text style={{ fontFamily: fonts.regular, color: c.mutedForeground }}>· {people.length}</Text>
        </Text>
        <AvatarStack people={people} />
        <ChevronRight size={16} color={c.mutedForeground} style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }} />
      </Pressable>
      {open && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 6 }}>
          {people.map((p) => (
            <View key={p.id} style={{ backgroundColor: color + "1f", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color }}>
                {p.name.split(" ")[0]}
                {p.pages ? ` · ${p.pages}` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Sohbetin ortasındaki gün kartı */
export function DayCardFull({ card, groupId, onReported, highlight }: { card: Card; groupId: string; onReported?: () => void; highlight?: boolean }) {
  const c = useColors();
  const total = card.read.length + card.min.length + card.none.length + card.pending.length;
  const seg = (n: number, color: string) => (n ? <View style={{ flex: n, backgroundColor: color }} /> : null);
  return (
    <View
      style={{
        alignSelf: "center",
        width: "100%",
        maxWidth: 440,
        backgroundColor: c.card,
        borderRadius: 18,
        borderWidth: highlight ? 2 : 1,
        borderColor: highlight ? c.primary : c.border,
        padding: 16,
        gap: 10,
        marginVertical: 14,
        elevation: 3,
        shadowColor: "#4a1010",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: c.primary }}>OKUMA GÜNÜ</Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: c.foreground }}>{formatDayLong(card.dayKey)}</Text>
        </View>
        {card.open ? (
          <View style={{ alignItems: "flex-end" }}>
            <Muted>Son bildirim {formatClock(card.deadline)}</Muted>
            <Countdown to={card.deadline} style={{ fontSize: 14 }} />
          </View>
        ) : (
          <Row gap={4} style={{ backgroundColor: c.muted, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Lock size={12} color={c.mutedForeground} />
            <Muted>Kapandı</Muted>
          </Row>
        )}
      </Row>
      {total > 0 && (
        <View style={{ gap: 4 }}>
          <View style={{ height: 6, borderRadius: 3, overflow: "hidden", flexDirection: "row", backgroundColor: c.muted }}>
            {seg(card.read.length, c.success)}
            {seg(card.min.length, c.warning)}
            {seg(card.none.length, c.destructive)}
            {seg(card.pending.length, c.muted)}
          </View>
          <Muted>
            {card.read.length + card.min.length}/{total} kişi en az alt sınırı okudu
          </Muted>
        </View>
      )}
      <View>
        {CATS.map((cat) => (
          <CategoryRow key={cat.key} cat={cat} people={card[cat.key]} />
        ))}
      </View>
      {card.open && card.me && (
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
          {(card.me.teamName || !card.me.eligible) && (
            <Muted>
              {card.me.teamName ? `${card.me.teamName} ekibi` : ""}
              {card.me.teamName && !card.me.eligible ? " · " : ""}
              {!card.me.eligible ? "bugün katıldığın için ceza yazılmaz" : ""}
            </Muted>
          )}
          <ReportControls groupId={groupId} card={card} onDone={onReported} />
        </View>
      )}
    </View>
  );
}

/** Bugün ekranındaki sade kart; dokununca grubun sohbetinde bu güne gider */
export function DayCardMini({ card, groupId, groupName }: { card: Card; groupId: string; groupName: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/group/[id]", params: { id: groupId, day: card.dayKey } })}
      style={({ pressed }) => [{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius + 6, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 }]}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 16, color: c.foreground }}>
            {groupName}
          </Text>
          <Muted>{formatDayLong(card.dayKey)}</Muted>
        </View>
        {card.open ? (
          <Row gap={4}>
            <Clock size={13} color={c.mutedForeground} />
            <Countdown to={card.deadline} style={{ fontSize: 12 }} />
          </Row>
        ) : (
          <Muted>Kapandı</Muted>
        )}
      </Row>
      <Row style={{ flexWrap: "wrap" }} gap={14}>
        {CATS.map((cat) =>
          card[cat.key].length ? (
            <Row key={cat.key} gap={4}>
              <AvatarStack people={card[cat.key]} size={20} max={3} />
              <cat.Icon size={13} color={cat.color(c)} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: cat.color(c) }}>{card[cat.key].length}</Text>
            </Row>
          ) : null,
        )}
        <ChevronRight size={16} color={c.mutedForeground} style={{ marginLeft: "auto" }} />
      </Row>
      {card.open && card.me && (
        <>
          {!card.me.eligible && <Muted>Bugün katıldığın için ceza yazılmaz</Muted>}
          <ReportControls groupId={groupId} card={card} compact />
        </>
      )}
    </Pressable>
  );
}
