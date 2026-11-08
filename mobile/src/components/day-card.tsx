import { router } from "expo-router";
import { BookHeart, BookOpen, Check, CheckCheck, ChevronRight, Clock, CloudOff, Link2, Lock, X, type LucideIcon } from "lucide-react-native";
import { memo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAction } from "@/lib/api";
import { useOfflineQueue } from "@/lib/offline";
import { formatDayLong, formatClock } from "@/lib/format";
import { fonts, KEFARET, radius, useColors } from "@/lib/theme";
import type { DayCard as Card } from "@/lib/types";
import { Countdown } from "./countdown";
import { Avatar, Row } from "./ui";

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

/** Tüm eserler için hangi toplu seçim aktif (geri almak için aynı butona basılır) */
function wholeChoice(books: { pages: number | null; target: number; min: number }[]): "all" | "min" | "none" | null {
  if (!books.length || books.some((b) => b.pages == null)) return null;
  if (books.every((b) => b.pages! >= b.target)) return "all";
  if (books.every((b) => b.pages === 0)) return "none";
  if (books.every((b) => b.pages === b.min)) return "min";
  return null;
}
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
  const busy = (key: string) => action.isPending && action.variables?.body?.key === key;
  // toggle: aynı butona tekrar basılırsa bildirim geri alınır (beklemeye döner)
  // dayKey: internet yoksa işlem bu güne ait olarak sıraya alınır
  const send = (body: Record<string, unknown>, key: string) => action.mutate({ name: "reportReading", body: { groupId, dayKey: card.dayKey, ...body, key, toggle: "1" } }, { onSuccess: () => onDone?.() });
  const BTNS: { key: BookChoice; Icon: LucideIcon; color: string }[] = [
    { key: "read", Icon: CheckCheck, color: c.success },
    { key: "min", Icon: Check, color: c.warning },
    { key: "none", Icon: X, color: c.destructive },
  ];
  const active = me.kefaret ? "kefaret" : wholeChoice(me.books);
  const plan = me.plan ?? null;
  const fine = me.fine;
  // Kısa etiketler; ayrıntılar butonların altındaki yardım satırında
  const bottom: { key: string; label: string; hint: string; corner?: string; Icon: LucideIcon; variant: "kefaret" | "success" | "primary" | "ghost"; body: Record<string, unknown> }[] = [
    ...(plan
      ? [{ key: "kefaret", label: "Kefaret", hint: `Kefaret okuması: bugün ${me.target + plan.dailyExtra} sayfa`, corner: `${me.target + plan.dailyExtra} sf`, Icon: BookHeart, variant: "kefaret" as const, body: { choice: "kefaret" } }]
      : []),
    { key: "all", label: "Okudum", hint: `Okudum: ${me.target} sayfa`, corner: `${me.target} sf`, Icon: CheckCheck, variant: "success", body: { choice: "all" } },
    { key: "min", label: "Alt sınır", hint: `Alt sınırı okudum: ${me.min} sayfa`, corner: `${me.min} sf`, Icon: Check, variant: "primary", body: { choice: "min" } },
    { key: "none", label: "Okumadım", hint: fine ? `Okumadım: ${fine.none} TL ceza` : "Okumadım", corner: fine ? `${fine.none} TL` : undefined, Icon: X, variant: "ghost", body: { choice: "none" } },
  ];
  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10 }}>
        {me.books.map((b, i) => {
          const st = bookState(b);
          return (
            <Row key={b.id} gap={6} style={{ paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <BookOpen size={14} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>
                  {b.title}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>
                  Hedef {b.target} · alt sınır {b.min}
                  {b.pages != null ? <Text style={{ fontFamily: fonts.semibold, color: c.foreground }}> · {b.pages} sf</Text> : null}
                </Text>
                {b.linked?.length ? (
                  <Row gap={3}>
                    <Link2 size={11} color={c.info} />
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 10, color: c.info }}>
                      {b.linked.join(", ")} ile ortak
                    </Text>
                  </Row>
                ) : null}
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
                    style={{ width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderColor: on ? color : c.border, backgroundColor: on ? color : c.card, alignItems: "center", justifyContent: "center" }}
                  >
                    {busy(k) ? <ActivityIndicator size="small" color={on ? "#fff" : color} /> : <Icon size={15} color={on ? "#fff" : c.mutedForeground} strokeWidth={2.6} />}
                  </Pressable>
                );
              })}
            </Row>
          );
        })}
      </View>
      <Row gap={5} style={{ paddingTop: 4 }}>
        {bottom.map((b) => {
          const fg = b.variant === "ghost" ? c.foreground : "#fff";
          const tone = b.variant === "kefaret" ? KEFARET : b.variant === "success" ? c.success : b.variant === "primary" ? c.primary : c.destructive;
          return (
            <Pressable
              key={b.key}
              disabled={action.isPending}
              onPress={() => send(b.body, b.key)}
              accessibilityLabel={b.hint}
              accessibilityState={{ selected: active === b.key }}
              style={({ pressed }) => [
                {
                  flexGrow: 1,
                  flexShrink: 1,
                  height: 30,
                  borderRadius: radius,
                  borderWidth: 1,
                  borderColor: b.variant === "ghost" ? c.border : "transparent",
                  backgroundColor: b.variant === "kefaret" ? KEFARET : b.variant === "success" ? c.success : b.variant === "primary" ? c.primary : c.card,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  paddingHorizontal: 5,
                  opacity: pressed ? 0.85 : 1,
                },
                active === b.key && { borderWidth: 2, borderColor: c.foreground + "80" },
              ]}
            >
              {b.corner && (
                // Sağ üst çentik: sayfa / ceza; köşe yuvarlaklığı butonla aynı
                <View style={{ position: "absolute", top: -6, right: -2, backgroundColor: c.card, borderRadius: radius, borderWidth: 0.8, borderColor: tone, paddingHorizontal: 3 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 7.5, lineHeight: 10, color: tone }}>{b.corner}</Text>
                </View>
              )}
              {busy(b.key) ? <ActivityIndicator size="small" color={fg} /> : <b.Icon size={11} color={fg} />}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 10, color: fg }}>
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </Row>
      <OfflinePending groupId={groupId} dayKey={card.dayKey} />
      {plan && (
        <Row gap={4} style={{ justifyContent: "center" }}>
          <BookHeart size={12} color={KEFARET} />
          <Text style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, color: KEFARET }}>
            Kefaret {plan.doneDays}/{plan.days} gün · kazanılan {plan.earned}/{plan.discountTotal} TL · günlük ≈{Math.round(plan.discountTotal / plan.days)} TL
          </Text>
        </Row>
      )}
    </View>
  );
}

/** Çevrimdışı kaydedilip henüz gönderilmemiş işlemler */
function OfflinePending({ groupId, dayKey }: { groupId: string; dayKey: string }) {
  const c = useColors();
  const items = useOfflineQueue().filter((i) => i.groupId === groupId && i.dayKey === dayKey);
  if (!items.length) return null;
  const last = items[items.length - 1];
  return (
    <Row gap={6} style={{ backgroundColor: c.warning + "1f", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
      <CloudOff size={13} color={c.warning} />
      <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 11, color: c.warning }}>
        Çevrimdışı kaydedildi: {last.label}
        {items.length > 1 ? ` (+${items.length - 1})` : ""} · internet gelince işlem saatiyle gönderilecek
      </Text>
    </Row>
  );
}

/** Okuyanların oranı: büyük bar + kısa sayı */
function DayProgress({ card }: { card: Card }) {
  const c = useColors();
  const total = card.read.length + card.min.length + card.none.length + card.pending.length;
  const done = card.read.length + card.min.length;
  if (!total) return null;
  const seg = (n: number, color: string) => (n ? <View style={{ flex: n, backgroundColor: color }} /> : null);
  return (
    <Row gap={8}>
      <View style={{ flex: 1, height: 10, borderRadius: 5, overflow: "hidden", flexDirection: "row", backgroundColor: c.muted }}>
        {seg(card.read.length, c.success)}
        {seg(card.min.length, c.warning)}
        {seg(card.none.length, c.destructive)}
        {seg(card.pending.length, c.muted)}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.foreground }}>
        {done}
        <Text style={{ fontFamily: fonts.semibold, color: c.mutedForeground }}>/{total}</Text>
      </Text>
    </Row>
  );
}

/**
 * Günün hasılatı: kasanın o gün alacağı ceza. Kartın üst kenarının ortasında, kenarlığa bitişik küçük çıkıntı.
 * Gün açıkken bildirmeyenler okumadı sayılır (en kötü durum); okudukça düşer.
 */
function RevenueTab({ card }: { card: Card }) {
  const c = useColors();
  if (card.penaltyTotal == null) return null; // eski sunucu
  const v = card.penaltyTotal;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: -10, left: 0, right: 0, alignItems: "center", zIndex: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: c.mutedForeground }}>
          Günün hasılatı <Text style={{ fontFamily: fonts.bold, color: v ? c.destructive : c.success }}>{v} TL</Text>
        </Text>
      </View>
    </View>
  );
}

/** Süre / kapandı göstergesi */
function DeadlinePill({ card, withClock }: { card: Card; withClock?: boolean }) {
  const c = useColors();
  if (!card.open)
    return (
      <Row gap={4} style={{ backgroundColor: c.muted, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Lock size={11} color={c.mutedForeground} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: c.mutedForeground }}>Kapandı</Text>
      </Row>
    );
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Row gap={4}>
        <Clock size={13} color={c.mutedForeground} />
        <Countdown to={card.deadline} style={{ fontSize: 12 }} />
      </Row>
      {withClock && <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>Son bildirim {formatClock(card.deadline)}</Text>}
    </View>
  );
}

/** Kategori çipleri: üst üste profil resimleri + sayı; dokununca isimler açılır */
function CategoryChips({ card, interactive }: { card: Card; interactive?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState<Cat["key"] | null>(null);
  const cats = CATS.filter((cat) => card[cat.key].length);
  if (!cats.length) return null;
  const sel = cats.find((cat) => cat.key === open);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {cats.map((cat) => {
          const color = cat.color(c);
          const people = card[cat.key];
          const on = open === cat.key;
          const body = (
            <>
              <AvatarStack people={people} size={18} max={3} />
              <cat.Icon size={12} color={color} strokeWidth={2.6} />
              {interactive && <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color }}>{cat.label}</Text>}
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color }}>{people.length}</Text>
            </>
          );
          const style = { flexDirection: "row" as const, alignItems: "center" as const, gap: 3, backgroundColor: color + "1f", borderRadius: 99, paddingLeft: 2, paddingRight: 8, paddingVertical: 2, borderWidth: 1, borderColor: on ? color : "transparent" };
          return interactive ? (
            <Pressable key={cat.key} onPress={() => setOpen((o) => (o === cat.key ? null : cat.key))} style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>
              {body}
            </Pressable>
          ) : (
            <View key={cat.key} style={style}>
              {body}
            </View>
          );
        })}
      </View>
      {sel && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, backgroundColor: sel.color(c) + "14", borderRadius: 10, padding: 6 }}>
          {card[sel.key].map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.card, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: sel.color(c) }}>{p.name}</Text>
              {p.kefaret ? <BookHeart size={11} color={KEFARET} /> : null}
              {p.pages ? <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: sel.color(c) }}>· {p.pages}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Sohbetin ortasındaki gün kartı */
export const DayCardFull = memo(function DayCardFull({ card, groupId, onReported, highlight }: { card: Card; groupId: string; onReported?: () => void; highlight?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        alignSelf: "center",
        width: "100%",
        maxWidth: 440,
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: highlight ? 2 : 1,
        borderColor: highlight ? c.primary : c.border,
        padding: 12,
        paddingTop: 14,
        gap: 8,
        marginVertical: 14,
        elevation: 2,
        shadowColor: "#4a1010",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <RevenueTab card={card} />
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, color: c.primary }}>OKUMA GÜNÜ</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 15, color: c.foreground }}>
            {formatDayLong(card.dayKey)}
          </Text>
        </View>
        <DeadlinePill card={card} withClock />
      </Row>
      <DayProgress card={card} />
      <CategoryChips card={card} interactive />
      {card.open && card.me && (
        <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
          {(card.me.teamName || !card.me.eligible) && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>
              {card.me.teamName ? <Text style={{ fontFamily: fonts.semibold, color: c.foreground }}>{card.me.teamName} ekibi</Text> : null}
              {card.me.teamName && !card.me.eligible ? " · " : ""}
              {!card.me.eligible ? "bugün katıldığın için ceza yazılmaz" : ""}
            </Text>
          )}
          <ReportControls groupId={groupId} card={card} onDone={onReported} />
        </View>
      )}
    </View>
  );
});

/** Bugün ekranındaki sade kart; dokununca grubun sohbetinde bu güne gider */
export function DayCardMini({ card, groupId, groupName }: { card: Card; groupId: string; groupName: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/group/[id]", params: { id: groupId, day: card.dayKey } })}
      style={({ pressed }) => [{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius + 6, padding: 12, paddingTop: 14, marginTop: 8, gap: 8, opacity: pressed ? 0.85 : 1 }]}
    >
      <RevenueTab card={card} />
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 15, color: c.foreground }}>
            {groupName}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>{formatDayLong(card.dayKey)}</Text>
        </View>
        <DeadlinePill card={card} />
      </Row>
      <DayProgress card={card} />
      <Row gap={6}>
        <View style={{ flex: 1 }}>
          <CategoryChips card={card} />
        </View>
        <ChevronRight size={16} color={c.mutedForeground} />
      </Row>
      {card.open && card.me && (
        <>
          {!card.me.eligible && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Bugün katıldığın için ceza yazılmaz</Text>}
          <ReportControls groupId={groupId} card={card} compact />
        </>
      )}
    </Pressable>
  );
}

/** Sohbette gün kartı ekranda değilken başlığın altında duran kısayol: temel bilgi + temel butonlar */
export function DayShortcut({ card, groupId, onJump, onReported }: { card: Card; groupId: string; onJump: () => void; onReported?: () => void }) {
  const c = useColors();
  const action = useAction();
  const total = card.read.length + card.min.length + card.none.length + card.pending.length;
  const done = card.read.length + card.min.length;
  const me = card.me;
  const myState = me?.pages == null ? null : me.pages >= me.target ? "read" : me.pages >= me.min && me.pages > 0 ? "min" : "none";
  const btns: { choice: string; state: string; label: string; Icon: LucideIcon; color: string }[] = [
    { choice: "all", state: "read", label: "Okudum", Icon: CheckCheck, color: c.success },
    { choice: "min", state: "min", label: "Alt sınır", Icon: Check, color: c.warning },
    { choice: "none", state: "none", label: "Okumadım", Icon: X, color: c.destructive },
  ];
  const busy = (k: string) => action.isPending && action.variables?.body?.key === `sc-${k}`;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Pressable onPress={onJump} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityLabel="Gün kartına git">
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c.primary + "1a", alignItems: "center", justifyContent: "center" }}>
          <BookOpen size={15} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, color: c.foreground }}>
            {formatDayLong(card.dayKey)}
          </Text>
          <Row gap={4}>
            {card.open ? <Countdown to={card.deadline} style={{ fontSize: 11 }} /> : <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Kapandı</Text>}
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>
              · {done}/{total} okudu
            </Text>
          </Row>
        </View>
      </Pressable>
      {card.open && me ? (
        <Row gap={4}>
          {btns.map((b) => {
            const on = myState === b.state;
            return (
              <Pressable
                key={b.choice}
                disabled={action.isPending}
                accessibilityLabel={b.label}
                onPress={() => action.mutate({ name: "reportReading", body: { groupId, dayKey: card.dayKey, choice: b.choice, key: `sc-${b.choice}`, toggle: "1" } }, { onSuccess: () => onReported?.() })}
                style={{ height: 32, minWidth: 34, paddingHorizontal: 7, borderRadius: 8, borderWidth: 1, borderColor: on ? b.color : c.border, backgroundColor: on ? b.color : c.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3 }}
              >
                {busy(b.choice) ? <ActivityIndicator size="small" color={on ? "#fff" : b.color} /> : <b.Icon size={14} color={on ? "#fff" : b.color} strokeWidth={2.6} />}
              </Pressable>
            );
          })}
        </Row>
      ) : (
        <ChevronRight size={16} color={c.mutedForeground} />
      )}
    </View>
  );
}
