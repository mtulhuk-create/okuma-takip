import { router } from "expo-router";
import { BookOpenCheck, Check, CheckCheck, ChevronRight, Clock, Lock, Pencil, X, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAction } from "@/lib/api";
import { formatDayLong, formatClock } from "@/lib/format";
import { fonts, radius, useColors } from "@/lib/theme";
import type { DayCard as Card, DayPerson } from "@/lib/types";
import { Countdown } from "./countdown";
import { Avatar, Body, Button, Input, Muted, Row } from "./ui";

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

export function ReportControls({ groupId, card, compact, onDone }: { groupId: string; card: Card; compact?: boolean; onDone?: () => void }) {
  const c = useColors();
  const action = useAction();
  const me = card.me!;
  const [editing, setEditing] = useState(false);
  const [pages, setPages] = useState(String(me.pages ?? me.target));
  const busy = (choice: string) => action.isPending && action.variables?.body?.choice === choice;
  const send = (choice: "pages" | "min" | "none") =>
    action.mutate(
      { name: "reportReading", body: { groupId, choice, pages: choice === "pages" ? pages : undefined } },
      {
        onSuccess: () => {
          setEditing(false);
          onDone?.();
        },
      },
    );

  if (me.pages != null && !editing) {
    const ok = me.pages >= me.min;
    const col = ok ? c.success : c.destructive;
    return (
      <Row style={{ justifyContent: "space-between", backgroundColor: (ok ? c.successBg : c.dangerBg), borderRadius: radius + 2, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Row gap={6}>
          {ok ? <CheckCheck size={16} color={col} /> : <X size={16} color={col} />}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: col }}>
            {me.pages} sayfa {me.pages >= me.target ? "· hedef tamam" : me.pages >= me.min ? "· alt sınır" : ""}
          </Text>
        </Row>
        <Button title="Değiştir" icon={Pencil} small variant="ghost" onPress={() => setEditing(true)} />
      </Row>
    );
  }
  if (editing) {
    return (
      <Row>
        <Input value={pages} onChangeText={setPages} keyboardType="number-pad" autoFocus placeholder="Kaç sayfa?" />
        <Button title="Kaydet" icon={Check} variant="success" loading={busy("pages")} onPress={() => send("pages")} />
        <Button title="" icon={X} variant="ghost" onPress={() => setEditing(false)} />
      </Row>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Row>
        <Button title="Okudum" icon={BookOpenCheck} variant="success" small={compact} style={{ flex: 1 }} onPress={() => setEditing(true)} />
        <Button title="Okumadım" icon={X} variant="ghost" small={compact} style={{ flex: 1 }} loading={busy("none")} onPress={() => send("none")} />
      </Row>
      <Button title={`Alt sınırı okudum (${me.min})`} icon={Check} small={compact} loading={busy("min")} onPress={() => send("min")} />
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
          <Muted>
            {card.me.teamName ? `${card.me.teamName} · ` : ""}Hedef {card.me.target} sayfa · alt sınır {card.me.min}
            {!card.me.eligible ? " · bugün katıldığın için ceza yazılmaz" : ""}
          </Muted>
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
          <Muted>
            Hedef {card.me.target} · alt sınır {card.me.min}
            {!card.me.eligible ? " · bugün ceza yok" : ""}
          </Muted>
          <ReportControls groupId={groupId} card={card} compact />
        </>
      )}
    </Pressable>
  );
}

export function WeekTable({ days, rows }: { days: string[]; rows: { user: { id: string; name: string; imageUrl: string | null }; cells: string[] }[] }) {
  const c = useColors();
  const DOW = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
  const cell = (k: string) => {
    const map: Record<string, [LucideIcon, string, string]> = {
      read: [CheckCheck, c.success, c.successBg],
      min: [Check, c.warning, c.warningBg],
      none: [X, c.destructive, c.dangerBg],
      pending: [Clock, c.mutedForeground, c.muted],
    };
    const v = map[k];
    if (!v) return <Text style={{ color: c.mutedForeground, opacity: 0.4 }}>–</Text>;
    const [Icon, fg, bg] = v;
    return (
      <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Icon size={13} color={fg} strokeWidth={2.6} />
      </View>
    );
  };
  return (
    <View style={{ gap: 6 }}>
      <Row gap={0}>
        <View style={{ flex: 1 }} />
        {days.map((d, i) => {
          const [y, m, day] = d.split("-").map(Number);
          return (
            <View key={d} style={{ width: 32, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: i === days.length - 1 ? c.primary : c.mutedForeground }}>{DOW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>{day}</Text>
            </View>
          );
        })}
      </Row>
      {rows.map((r) => (
        <Row key={r.user.id} gap={0}>
          <Row style={{ flex: 1 }} gap={6}>
            <Avatar name={r.user.name} uri={r.user.imageUrl} size={24} />
            <Body numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
              {r.user.name.split(" ")[0]}
            </Body>
          </Row>
          {r.cells.map((k, i) => (
            <View key={i} style={{ width: 32, alignItems: "center" }}>
              {cell(k)}
            </View>
          ))}
        </Row>
      ))}
    </View>
  );
}
