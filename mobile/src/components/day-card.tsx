import { router } from "expo-router";
import { BookHeart, BookOpen, Flame, Check, CheckCheck, ChevronRight, Clock, CloudOff, Link2, Lock, X, type LucideIcon } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, Platform, Vibration, Animated, useColorScheme, type StyleProp, type ViewStyle } from "react-native";
import { useAction } from "@/lib/api";
import { useOfflineQueue } from "@/lib/offline";
import { formatDayLong, formatClock } from "@/lib/format";
import { fonts, KEFARET, radius, STATE, useColors } from "@/lib/theme";
import type { DayCard as Card } from "@/lib/types";
import { Countdown } from "./countdown";
import { Avatar, Row, TIER_COLORS } from "./ui";

type Cat = { key: "kefaret" | "read" | "min" | "none" | "pending"; label: string; Icon: LucideIcon; color: (c: ReturnType<typeof useColors>) => string };
const CATS: Cat[] = [
  { key: "kefaret", label: "Kefaret", Icon: BookHeart, color: () => STATE.kefaret },
  { key: "read", label: "Okudu", Icon: CheckCheck, color: () => STATE.read },
  { key: "min", label: "Alt sınır", Icon: Check, color: () => STATE.min },
  { key: "none", label: "Okumadı", Icon: X, color: () => STATE.none },
  { key: "pending", label: "Bekleniyor", Icon: Clock, color: (c) => c.mutedForeground },
];

export function AvatarStack({ people, size = 26, max = 5 }: { people: { id: string; name: string; imageUrl: string | null; initial?: string; tier?: "gold" | "silver" | "bronze" }[]; size?: number; max?: number }) {
  const c = useColors();
  const rest = people.length - max;
  return (
    <View style={{ flexDirection: "row" }}>
      {people.slice(0, max).map((p, i) => (
        <View key={p.id} style={{ marginLeft: i ? -7 : 0, borderWidth: 1.5, borderColor: c.card, borderRadius: size }}>
          <Avatar name={p.name} uri={p.imageUrl} initial={p.initial} seed={p.id} size={size} frame={p.tier} />
        </View>
      ))}
      {rest > 0 && (
        <View style={{ marginLeft: -7, width: size + 3, height: size + 3, borderRadius: size, backgroundColor: c.muted, borderWidth: 1.5, borderColor: c.card, alignItems: "center", justifyContent: "center" }}>
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
  const send = (body: Record<string, unknown>, key: string) => tap() || action.mutate({ name: "reportReading", body: { groupId, dayKey: card.dayKey, ...body, key, toggle: "1" } }, { onSuccess: () => onDone?.() });
  const BTNS: { key: BookChoice; Icon: LucideIcon; color: string }[] = [
    { key: "read", Icon: CheckCheck, color: STATE.read },
    { key: "min", Icon: Check, color: STATE.min },
    { key: "none", Icon: X, color: STATE.none },
  ];
  const active = me.kefaret ? "kefaret" : wholeChoice(me.books);
  const plan = me.plan ?? null;
  const fine = me.fine;
  // Kefaret okumasında her esere düşen sayfa (sunucudaki dağıtımla aynı: hedefleri oranında)
  const kefPages = new Map<string, number>();
  if (plan) {
    const sum = me.books.reduce((n, b) => n + b.target, 0) || 1;
    let left = plan.dailyExtra;
    me.books.forEach((b, i) => {
      const share = i === me.books.length - 1 ? left : Math.min(left, Math.floor((plan.dailyExtra * b.target) / sum));
      left -= share;
      kefPages.set(b.id, b.target + share);
    });
  }
  const dense = !!plan; // 4 buton varken bir tık küçük
  const selectedBorder = useColorScheme() === "dark" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.35)";
  // Kısa etiketler; ayrıntılar butonların altındaki yardım satırında
  // Renkler okuma takip tablosuyla aynı; sağ üst çentik sayfa, sağ alt çentik ceza ("-10 TL")
  const bottom: { key: string; label: string; hint: string; corner?: string; fine?: string; Icon: LucideIcon; color: string; body: Record<string, unknown> }[] = [
    ...(plan
      ? [{ key: "kefaret", label: "Kefaret", hint: `Kefaret okuması: bugün ${me.target + plan.dailyExtra} sayfa`, corner: `${me.target + plan.dailyExtra} sf`, Icon: BookHeart, color: STATE.kefaret, body: { choice: "kefaret" } }]
      : []),
    { key: "all", label: "Okudum", hint: `Okudum: ${me.target} sayfa`, corner: `${me.target} sf`, Icon: CheckCheck, color: STATE.read, body: { choice: "all" } },
    { key: "min", label: "Alt sınır", hint: `Alt sınırı okudum: ${me.min} sayfa${fine?.min ? `, ${fine.min} TL ceza` : ""}`, corner: `${me.min} sf`, fine: fine?.min ? `-${fine.min} TL` : undefined, Icon: Check, color: STATE.min, body: { choice: "min" } },
    { key: "none", label: "Okumadım", hint: fine ? `Okumadım: ${fine.none} TL ceza` : "Okumadım", fine: fine ? `-${fine.none} TL` : undefined, Icon: X, color: STATE.none, body: { choice: "none" } },
  ];
  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10 }}>
        {me.books.map((b, i) => {
          const st = bookState(b);
          return (
            <Row key={b.id} gap={8} style={{ paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <BookOpen size={14} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>
                  {b.title}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>
                  Hedef {b.target} · alt sınır {b.min}
                  {plan ? <Text style={{ color: KEFARET }}> · kefaret {kefPages.get(b.id)}</Text> : null}
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
              {plan && (
                <Pressable
                  accessibilityLabel={`${b.title}: kefaret okuması`}
                  disabled={action.isPending}
                  onPress={() => send({ choice: "kefaret" }, `${b.id}-kefaret`)}
                  style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderColor: active === "kefaret" ? KEFARET : KEFARET + "66", backgroundColor: active === "kefaret" ? KEFARET : c.card, alignItems: "center", justifyContent: "center" }, pressFx(pressed)]}
                >
                  {busy(`${b.id}-kefaret`) ? <ActivityIndicator size="small" color={active === "kefaret" ? "#fff" : KEFARET} /> : <BookHeart size={15} color={active === "kefaret" ? "#fff" : KEFARET} strokeWidth={2.4} />}
                </Pressable>
              )}
              {BTNS.map(({ key, Icon, color }) => {
                const on = st === key;
                const k = `${b.id}-${key}`;
                return (
                  <Pressable
                    key={key}
                    accessibilityLabel={`${b.title}: ${key === "read" ? "Okudum" : key === "min" ? "Alt sınırı okudum" : "Okumadım"}`}
                    disabled={action.isPending}
                    onPress={() => send({ bookId: b.id, bookChoice: key }, k)}
                    style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderColor: on ? color : c.border, backgroundColor: on ? color : c.card, alignItems: "center", justifyContent: "center" }, pressFx(pressed)]}
                  >
                    {busy(k) ? <ActivityIndicator size="small" color={on ? "#fff" : color} /> : <Icon size={15} color={on ? "#fff" : c.mutedForeground} strokeWidth={2.6} />}
                  </Pressable>
                );
              })}
            </Row>
          );
        })}
      </View>
      {plan && <KefaretOffer plan={plan} today={card.dayKey} dailyPages={me.target + plan.dailyExtra} markedToday={!!me.kefaret} />}
      {/* Butonlar arası daha geniş, butonlar bir tık dar */}
      <Row gap={10} style={{ paddingTop: 4, paddingBottom: 5, paddingHorizontal: 6 }}>
        {bottom.map((b) => {
          const fg = "#fff";
          return (
            <Tappable
              key={b.key}
              disabled={action.isPending}
              onPress={() => send(b.body, b.key)}
              accessibilityLabel={b.hint}
              selected={active === b.key}
              outerStyle={{ flexGrow: 1, flexShrink: 1 }}
              style={{
                height: dense ? 26 : 30,
                borderRadius: radius,
                // Seçili: dış çerçeve yok, butonun kendi kenar rengi değişir
                borderWidth: 2,
                borderColor: active === b.key ? selectedBorder : "transparent",
                backgroundColor: b.color,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: dense ? 2 : 3,
                paddingHorizontal: dense ? 3 : 5,
              }}
            >
              {b.corner && (
                // Sağ üst çentik: sayfa; köşe yuvarlaklığı butonla aynı
                <View style={{ position: "absolute", top: -6, right: -2, backgroundColor: c.card, borderRadius: radius, borderWidth: 0.8, borderColor: b.color, paddingHorizontal: 3 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 7.5, lineHeight: 10, color: b.color }}>{b.corner}</Text>
                </View>
              )}
              {b.fine && (
                // Sağ alt çentik: yazılacak ceza
                <View style={{ position: "absolute", bottom: -6, right: -2, backgroundColor: c.card, borderRadius: radius, borderWidth: 0.8, borderColor: STATE.none, paddingHorizontal: 3 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 7.5, lineHeight: 10, color: STATE.none }}>{b.fine}</Text>
                </View>
              )}
              {busy(b.key) ? <ActivityIndicator size="small" color={fg} /> : <b.Icon size={dense ? 9 : 11} color={fg} />}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: dense ? 9 : 10, color: fg }}>
                {b.label}
              </Text>
            </Tappable>
          );
        })}
      </Row>
      <OfflinePending groupId={groupId} dayKey={card.dayKey} />
    </View>
  );
}

const addDay = (k: string, n: number) => new Date(Date.parse(k) + n * 86_400_000).toISOString().slice(0, 10);

/** Yöneticinin kefaret teklifi: kaç gün, ne kadar silinecek, ne kadarı silindi ve son günlerde kefaret yapılıp yapılmadığı */
function KefaretOffer({ plan, today, dailyPages, markedToday }: { plan: NonNullable<NonNullable<Card["me"]>["plan"]>; today: string; dailyPages: number; markedToday: boolean }) {
  const c = useColors();
  const perDay = Math.round(plan.discountTotal / plan.days);
  const used = new Set(plan.usedDays ?? []);
  if (markedToday) used.add(today);
  const pct = plan.discountTotal ? Math.min(100, Math.round((plan.earned / plan.discountTotal) * 100)) : 0;
  // Bugün kefaret okunduysa payı gün kapanınca düşer; o zamana kadar "bekliyor" görünür
  const pendingPct = markedToday && plan.discountTotal ? Math.min(100 - pct, Math.round((perDay / plan.discountTotal) * 100)) : 0;
  const recent: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDay(today, -i);
    if (k >= plan.startDay) recent.push(k);
  }
  const small = { fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground } as const;
  const strong = { fontFamily: fonts.bold, color: c.foreground } as const;
  return (
    <View style={{ gap: 4, backgroundColor: KEFARET + "12", borderWidth: 1, borderColor: KEFARET + "33", borderRadius: radius, paddingHorizontal: 8, paddingVertical: 6 }}>
      <Row gap={4}>
        <BookHeart size={13} color={KEFARET} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 10.5, color: KEFARET }}>
          Kefaret teklifi{plan.discountPercent ? ` · %${plan.discountPercent} indirim` : ""}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: KEFARET }}>
          {plan.doneDays}
          {markedToday ? "+1" : ""}/{plan.days} gün
        </Text>
      </Row>
      <Row gap={8}>
        <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: c.muted, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", width: "100%", height: "100%" }}>
            <View style={{ width: `${pct}%`, height: "100%", backgroundColor: KEFARET }} />
            <View style={{ width: `${pendingPct}%`, height: "100%", backgroundColor: KEFARET + "66" }} />
          </View>
        </View>
        <Text style={small}>
          <Text style={strong}>{plan.earned}</Text>/{plan.discountTotal} TL silindi
          {markedToday ? <Text style={{ color: KEFARET }}> · bugün +{perDay} TL</Text> : null}
        </Text>
      </Row>
      <Row gap={8}>
        <Text numberOfLines={1} style={{ ...small, flex: 1 }}>
          Günde <Text style={strong}>{dailyPages} sf</Text> · gün başı <Text style={strong}>{perDay} TL</Text> · kalan {Math.max(0, plan.discountTotal - plan.earned)} TL
        </Text>
        <Row gap={3}>
          {recent.map((k) => (
            <View key={k} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: used.has(k) ? KEFARET : c.mutedForeground + "40", borderWidth: k === today ? 1 : 0, borderColor: KEFARET }} />
          ))}
        </Row>
      </Row>
    </View>
  );
}

/** Dokunma geri bildirimi: kısa titreşim (Android) */
function tap(): false {
  if (Platform.OS === "android") Vibration.vibrate(12);
  return false;
}
/** Yaylı (spring) basma efekti: basınca tok biçimde küçülür ve kararır, bırakınca yumuşakça geri gelir */
function Tappable({
  children,
  style,
  outerStyle,
  onPress,
  disabled,
  selected,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style: StyleProp<ViewStyle>;
  outerStyle?: StyleProp<ViewStyle>;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
}) {
  const [v] = useState(() => new Animated.Value(0));
  const to = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 7 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(1)} onPressOut={() => to(0)} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected, disabled }} style={outerStyle}>
      <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }], opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Basılıyken küçülüp kararır (kısayol ve eser düğmeleri) */
const pressFx = (pressed: boolean) => (pressed ? { transform: [{ scale: 0.9 }], opacity: 0.7 } : null);

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
  const kef = card.read.filter((p) => p.kefaret).length;
  if (!total) return null;
  const seg = (n: number, color: string) => (n ? <View style={{ flex: n, backgroundColor: color }} /> : null);
  return (
    <Row gap={8}>
      <View style={{ flex: 1, height: 10, borderRadius: 5, overflow: "hidden", flexDirection: "row", backgroundColor: c.muted }}>
        {/* Kefaret okuyanlar ayrı renkte */}
        {seg(kef, STATE.kefaret)}
        {seg(card.read.length - kef, STATE.read)}
        {seg(card.min.length, STATE.min)}
        {seg(card.none.length, STATE.none)}
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
/** Gün kartında ayrıntı kapalıysa (grup ayarı): yalnızca bildirdi / bildirmedi */
const SIMPLE_CATS: Cat[] = [
  { key: "read", label: "Bildirdi", Icon: Check, color: () => STATE.read },
  { key: "pending", label: "Bildirmedi", Icon: Clock, color: (c) => c.mutedForeground },
];

/** İsim rozetinin sağ üst köşesinde hafif eğik alev; içinde küçük gün sayısı (tam seri yeşil) */
function StreakFlame({ s }: { s: { n: number; full: boolean } }) {
  if (s.n < 3) return null;
  const color = s.full ? "#10b981" : "#f97316";
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: -9, right: -5, width: 16, height: 16, alignItems: "center", justifyContent: "center", transform: [{ rotate: "12deg" }] }}>
      <Flame size={16} color={color} fill={color} strokeWidth={1.5} />
      <Text style={{ position: "absolute", top: 5, fontFamily: fonts.bold, fontSize: 6.5, lineHeight: 8, color: "#fff" }}>{s.n}</Text>
    </View>
  );
}

const CHIP_AVATAR = 22;

/**
 * Bir rozete sığan avatar sayısı: rozet ortadan başlar, avatar eklendikçe genişler; yuvasını doldurunca
 * kalanlar "+N" ile gösterilir. Yuva: satırda tek rozetse tüm genişlik, iki rozetse yarısı.
 */
function chipCapacity(slot: number, label: string, count: number, interactive?: boolean) {
  const step = CHIP_AVATAR - 7 + 3; // üst üste binen avatarın kapladığı
  const first = CHIP_AVATAR + 3;
  const text = 14 + (interactive ? label.length * 6.6 + 4 : 0) + String(count).length * 7.5 + 22; // simge, yazı, sayı, iç boşluk
  return Math.max(1, Math.floor((slot - text - first) / step) + 1);
}

/** Kim okudu rozetleri: satırda en çok 2 rozet, her biri kendi yuvasının ortasında; avatarlarda ekip çerçevesi */
function CategoryChips({ card, interactive }: { card: Card; interactive?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState<Cat["key"] | null>(null);
  const [width, setWidth] = useState(0);
  const simple = !!card.simple;
  // Kefaret okuyanlar "Okudu"dan ayrı, kendi renginde
  const lists: Record<Cat["key"], Card["read"]> = simple
    ? { kefaret: [], read: card.read, min: [], none: [], pending: card.pending }
    : { kefaret: card.read.filter((p) => p.kefaret), read: card.read.filter((p) => !p.kefaret), min: card.min, none: card.none, pending: card.pending };
  const cats = (simple ? SIMPLE_CATS : CATS).filter((cat) => lists[cat.key].length);
  if (!cats.length) return null;
  const sel = cats.find((cat) => cat.key === open);
  return (
    <View style={{ gap: 6 }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6 }}>
        {cats.map((cat, i) => {
          const color = cat.color(c);
          const people = lists[cat.key];
          const on = open === cat.key;
          // Satırda tek kalan (tek sayıda rozetin sonuncusu) tüm satırı yuva alır
          const alone = cats.length % 2 === 1 && i === cats.length - 1;
          const slot = width ? (alone ? width : width / 2 - 3) : 0;
          const cap = slot ? chipCapacity(slot, cat.label, people.length, interactive) : 4;
          const max = people.length > cap ? Math.max(1, cap - 1) : people.length;
          const body = (
            <>
              <AvatarStack people={people} size={CHIP_AVATAR} max={max} />
              <cat.Icon size={13} color={color} strokeWidth={2.6} />
              {interactive && <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color }}>{cat.label}</Text>}
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color }}>{people.length}</Text>
            </>
          );
          const style = {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            gap: 5,
            maxWidth: "100%" as const,
            backgroundColor: color + "1f",
            borderRadius: 99,
            paddingLeft: 2,
            paddingRight: 10,
            paddingVertical: 1,
            borderWidth: 1,
            borderColor: on ? color : "transparent",
          };
          return (
            <View key={cat.key} style={{ width: alone ? "100%" : "50%", alignItems: "center", paddingHorizontal: alone ? 0 : 3 }}>
              {interactive ? (
                <Pressable onPress={() => setOpen((o) => (o === cat.key ? null : cat.key))} style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>
                  {body}
                </Pressable>
              ) : (
                <View style={style}>{body}</View>
              )}
            </View>
          );
        })}
      </View>
      {sel && (
        // İsimler ortadan dizilir; ekip çerçevesi ince kenar, seri sağ üst köşede alev
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 5, rowGap: 10, backgroundColor: sel.color(c) + "14", borderRadius: 10, paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6 }}>
          {lists[sel.key].map((p) => (
            // Ekip çerçevesi: tüm kenar ince ve hafif saydam altın / gümüş / bronz
            <View
              key={p.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.card, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2, borderWidth: p.tier ? 0.75 : 1, borderColor: p.tier ? TIER_COLORS[p.tier] + "cc" : c.border }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: sel.color(c) }}>{p.name}</Text>
              {p.kefaret ? <BookHeart size={11} color={KEFARET} /> : null}
              {p.pages ? <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: sel.color(c) }}>· {p.pages}</Text> : null}
              {p.streak && <StreakFlame s={p.streak} />}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Gün kapanmadan önceki son 1 dakika (bildirim süresi) */
function useLastMinute(deadline: string, open: boolean) {
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    if (!open) return;
    const end = Date.parse(deadline);
    const tick = () => {
      const left = end - Date.now();
      setUrgent(left > 0 && left <= 60_000);
    };
    const t0 = setTimeout(tick, 0);
    const t1 = setTimeout(tick, Math.max(0, end - 60_000 - Date.now()));
    const t2 = setTimeout(tick, Math.max(0, end - Date.now() + 50));
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      setUrgent(false);
    };
  }, [deadline, open]);
  return urgent;
}

/** Son dakikada kartın kırmızı kenarı yanıp söner */
function BlinkBorder({ on, radius }: { on: boolean; radius: number }) {
  const c = useColors();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.15, duration: 450, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, v]);
  if (!on) return null;
  return <Animated.View pointerEvents="none" style={{ position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderRadius: radius + 1, borderWidth: 2, borderColor: c.primary, opacity: v }} />;
}

/** Sohbetin ortasındaki gün kartı */
export const DayCardFull = memo(function DayCardFull({ card, groupId, onReported, highlight }: { card: Card; groupId: string; onReported?: () => void; highlight?: boolean }) {
  const c = useColors();
  const urgent = useLastMinute(card.deadline, card.open);
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
      <BlinkBorder on={urgent} radius={16} />
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
  const urgent = useLastMinute(card.deadline, card.open);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/group/[id]", params: { id: groupId, day: card.dayKey } })}
      style={({ pressed }) => [{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius + 6, padding: 12, paddingTop: 14, marginTop: 8, gap: 8, opacity: pressed ? 0.85 : 1 }]}
    >
      <BlinkBorder on={urgent} radius={radius + 6} />
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
  const myState = me?.pages == null ? null : me.kefaret ? "kefaret" : me.pages >= me.target ? "read" : me.pages >= me.min && me.pages > 0 ? "min" : "none";
  const plan = me?.plan ?? null;
  const fine = me?.fine;
  // Gün kartındaki butonlarla aynı: kefaret (varsa) en başta, sağ üst çentikte sayfa / ceza
  const btns: { choice: string; state: string; label: string; corner?: string; fine?: string; Icon: LucideIcon; color: string }[] = [
    ...(plan && me ? [{ choice: "kefaret", state: "kefaret", label: "Kefaret okuması", corner: `${me.target + plan.dailyExtra} sf`, Icon: BookHeart, color: KEFARET }] : []),
    { choice: "all", state: "read", label: "Okudum", corner: me ? `${me.target} sf` : undefined, Icon: CheckCheck, color: STATE.read },
    { choice: "min", state: "min", label: "Alt sınır", corner: me ? `${me.min} sf` : undefined, fine: fine?.min ? `-${fine.min} TL` : undefined, Icon: Check, color: STATE.min },
    { choice: "none", state: "none", label: "Okumadım", fine: fine ? `-${fine.none} TL` : undefined, Icon: X, color: STATE.none },
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
        <Row gap={4} style={{ paddingTop: 4, paddingBottom: 4 }}>
          {btns.map((b) => {
            const on = myState === b.state;
            return (
              <Pressable
                key={b.choice}
                disabled={action.isPending}
                accessibilityLabel={b.label}
                onPress={() => tap() || action.mutate({ name: "reportReading", body: { groupId, dayKey: card.dayKey, choice: b.choice, key: `sc-${b.choice}`, toggle: "1" } }, { onSuccess: () => onReported?.() })}
                style={({ pressed }) => [{ height: 32, minWidth: 34, paddingHorizontal: 7, borderRadius: 8, borderWidth: 1, borderColor: on ? b.color : c.border, backgroundColor: on ? b.color : c.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3 }, pressFx(pressed)]}
              >
                {b.corner && (
                  <View style={{ position: "absolute", top: -6, right: -3, backgroundColor: c.card, borderRadius: radius, borderWidth: 0.8, borderColor: b.color, paddingHorizontal: 2 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 7, lineHeight: 9, color: b.color }}>{b.corner}</Text>
                  </View>
                )}
                {b.fine && (
                  <View style={{ position: "absolute", bottom: -6, right: -3, backgroundColor: c.card, borderRadius: radius, borderWidth: 0.8, borderColor: STATE.none, paddingHorizontal: 2 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 7, lineHeight: 9, color: STATE.none }}>{b.fine}</Text>
                  </View>
                )}
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
