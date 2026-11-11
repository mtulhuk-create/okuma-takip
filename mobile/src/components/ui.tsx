import { Image } from "expo-image";
import { BookX, type LucideIcon } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ScrollViewInstance,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, useColors, type Colors } from "@/lib/theme";

export function Screen({
  children,
  refreshing,
  onRefresh,
  padTop = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padTop?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // Ekrana her girişte en üstten başla (sekmeler açık kalsa da)
  const ref = useRef<ScrollViewInstance>(null);
  useFocusEffect(
    useCallback(() => {
      ref.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, paddingTop: padTop ? insets.top + 12 : 16, paddingBottom: 40 + insets.bottom, gap: 14 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "danger" | "accent" }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: c.border, shadowColor: "#4a1010" },
        tone === "danger" && { borderColor: c.destructive + "55", backgroundColor: c.dangerBg },
        tone === "accent" && { borderColor: c.primary + "40", backgroundColor: c.accent },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export function H1({ children, style, numberOfLines }: TextProps) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.serif, fontSize: 24, color: c.foreground }, style]}>
      {children}
    </Text>
  );
}

export function Title({ children, style, numberOfLines }: TextProps) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.semibold, fontSize: 16, color: c.foreground }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style, numberOfLines }: TextProps) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.foreground }, style]}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, numberOfLines }: TextProps) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: c.mutedForeground }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: c.mutedForeground, marginBottom: 4 }}>
      {children}
    </Text>
  );
}

type Variant = "primary" | "success" | "ghost" | "danger";

function variantStyle(v: Variant, c: Colors) {
  switch (v) {
    case "primary":
      return { bg: c.primary, fg: c.primaryForeground, border: c.primary };
    case "success":
      return { bg: c.success, fg: "#ffffff", border: c.success };
    case "danger":
      return { bg: c.destructive, fg: "#ffffff", border: c.destructive };
    default:
      return { bg: c.card, fg: c.foreground, border: c.border };
  }
}

export function Button({
  title,
  onPress,
  variant = "primary",
  small,
  loading,
  disabled,
  style,
  textColor,
  icon: Icon,
}: {
  icon?: LucideIcon;
  title: string;
  onPress?: () => void;
  variant?: Variant;
  small?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}) {
  const c = useColors();
  const v = variantStyle(variant, c);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.55 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {Icon && <Icon size={small ? 14 : 16} color={textColor ?? v.fg} strokeWidth={2.2} />}
          {!!title && <Text style={{ fontFamily: fonts.semibold, fontSize: small ? 12 : 14, color: textColor ?? v.fg, textAlign: "center" }}>{title}</Text>}
        </View>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const c = useColors();
  const { label, style, ...rest } = props;
  return (
    <View style={{ flexGrow: 1 }}>
      {label && <Label>{label}</Label>}
      <TextInput
        placeholderTextColor={c.mutedForeground}
        {...rest}
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }, props.multiline && { minHeight: 70, textAlignVertical: "top" }, style]}
      />
    </View>
  );
}

export type Tone = "success" | "warning" | "danger" | "neutral" | "primary" | "info";

export function Badge({ text, tone = "neutral" }: { text: string; tone?: Tone }) {
  const c = useColors();
  const map: Record<Tone, [string, string]> = {
    success: [c.successBg, c.success],
    warning: [c.warningBg, c.warning],
    danger: [c.dangerBg, c.destructive],
    neutral: [c.muted, c.mutedForeground],
    primary: [c.accent, c.accentForeground],
    info: [c.infoBg, c.info],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: fg }}>{text}</Text>
    </View>
  );
}

// Her kişiye sabit renk: açık modda açık, koyu modda koyu tonlar [arka plan, yazı]
const AVATAR_LIGHT = [
  ["#ffe4e6", "#9f1239"],
  ["#fef3c7", "#92400e"],
  ["#d1fae5", "#065f46"],
  ["#e0f2fe", "#075985"],
  ["#ede9fe", "#5b21b6"],
  ["#ffedd5", "#9a3412"],
  ["#ccfbf1", "#115e59"],
  ["#fae8ff", "#86198f"],
  ["#ecfccb", "#3f6212"],
  ["#e0e7ff", "#3730a3"],
] as const;
const AVATAR_DARK = [
  ["#881337", "#ffe4e6"],
  ["#78350f", "#fef3c7"],
  ["#064e3b", "#d1fae5"],
  ["#0c4a6e", "#e0f2fe"],
  ["#4c1d95", "#ede9fe"],
  ["#7c2d12", "#ffedd5"],
  ["#134e4a", "#ccfbf1"],
  ["#701a75", "#fae8ff"],
  ["#365314", "#ecfccb"],
  ["#312e81", "#e0e7ff"],
] as const;

/** Clerk'in fotoğrafsız kullanıcılara verdiği varsayılan resim gerçek fotoğraf sayılmaz */
export function isRealPhoto(uri?: string | null): uri is string {
  return !!uri && !uri.includes("eyJ0eXBlIjoiZGVmYXVsdCI");
}

/**
 * Profil resmi: mail hesabından gelen fotoğraf varsa o; yoksa kişiye özel renkte,
 * hesap (mail) adının baş harfiyle sistem avatarı.
 */
/**
 * Ekip hiyerarşisi çerçeveleri (gruba özel): yalnızca halka; üzerinde küçük baklava çıkıntılar.
 * Altın 4 çıkıntı (en şaşalı), gümüş 2, bronz 1 (üstte). Hepsi sade tutulur.
 */
export const TIER_COLORS = { gold: "#D4A017", silver: "#A7B1BC", bronze: "#B07040" } as const;
export type Tier = "gold" | "silver" | "bronze";
const TIER_NOTCHES: Record<Tier, ("top" | "bottom" | "left" | "right")[]> = { gold: ["top", "bottom", "left", "right"], silver: ["top", "bottom"], bronze: ["top"] };

/**
 * Ekip çerçevesinin çıkıntıları (avatardakiyle aynı): altın 4 kenar, gümüş üst + alt, bronz üst.
 * Kenarlıklı bir kutunun (geçmiş kutucuğu, isim rozeti) kenar çizgisinin tam ortasına oturur. bw: kenar kalınlığı.
 */
export function EdgeNotches({ tier, bw, d = 3 }: { tier: Tier; bw: number; d?: number }) {
  const c = useColors();
  const color = TIER_COLORS[tier];
  const edge = -bw / 2 - d / 2;
  // Yüzdeyle konumlama kullanılmaz: Android'de iç boşluklu kutularda (isim rozeti) nokta ortadan kayıyordu.
  // Her nokta, kenar boyunca uzanan ve içeriğini ortalayan bir şeridin içinde durur.
  const strip = {
    top: { left: 0, right: 0, top: edge, alignItems: "center" },
    bottom: { left: 0, right: 0, bottom: edge, alignItems: "center" },
    left: { top: 0, bottom: 0, left: edge, justifyContent: "center" },
    right: { top: 0, bottom: 0, right: edge, justifyContent: "center" },
  } as const;
  return (
    <>
      {TIER_NOTCHES[tier].map((p) => (
        <View key={p} pointerEvents="none" style={{ position: "absolute", ...strip[p] }}>
          <View style={{ width: d, height: d, backgroundColor: color, borderWidth: 0.6, borderColor: c.card, borderRadius: 0.5, transform: [{ rotate: "45deg" }] }} />
        </View>
      ))}
    </>
  );
}

export function Avatar({ name, uri, size = 36, initial, seed, frame }: { name: string; uri?: string | null; size?: number; initial?: string; seed?: string; frame?: Tier | null }) {
  const c = useColors();
  const inner = <AvatarCore name={name} uri={uri} size={size} initial={initial} seed={seed} />;
  if (!frame) return inner;
  // Halka avatarın üstüne çizilir (boyut değişmez, dairenin tam çevresine oturur); çıkıntılar halkanın üzerinde
  // Tüm çerçevelerde aynı, ince halka; çıkıntılar küçük (göze batmasın)
  const bw = 1;
  const R = size + bw * 2;
  const d = Math.max(2.5, size * 0.096);
  const color = TIER_COLORS[frame];
  const mid = size / 2 - d / 2;
  const at = { top: { left: mid, top: -bw / 2 - d / 2 }, bottom: { left: mid, top: size + bw / 2 - d / 2 }, left: { left: -bw / 2 - d / 2, top: mid }, right: { left: size + bw / 2 - d / 2, top: mid } };
  return (
    <View style={{ width: size, height: size }}>
      {inner}
      <View pointerEvents="none" style={{ position: "absolute", left: -bw, top: -bw, width: R, height: R, borderRadius: R / 2, borderWidth: bw, borderColor: color }} />
      {TIER_NOTCHES[frame].map((p) => (
        <View key={p} pointerEvents="none" style={{ position: "absolute", ...at[p], width: d, height: d, backgroundColor: color, borderWidth: 0.6, borderColor: c.card, transform: [{ rotate: "45deg" }], borderRadius: 0.5 }} />
      ))}
    </View>
  );
}

function AvatarCore({ name, uri, size = 36, initial, seed }: { name: string; uri?: string | null; size?: number; initial?: string; seed?: string }) {
  const dark = useColorScheme() === "dark";
  if (isRealPhoto(uri)) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  const key = seed || name;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = (dark ? AVATAR_DARK : AVATAR_LIGHT)[h % AVATAR_LIGHT.length];
  const letter = (initial || name.trim().match(/\p{L}|\d/u)?.[0] || "?").toLocaleUpperCase("tr-TR");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.42, lineHeight: size * 0.6, color: fg }}>{letter}</Text>
    </View>
  );
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string; icon?: LucideIcon }[] }) {
  const c = useColors();
  return (
    <Row gap={8}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + "12" : c.card }]}
          >
            {o.icon && <o.icon size={22} color={active ? c.primary : c.mutedForeground} style={{ marginBottom: 4 }} />}
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{o.label}</Text>
            {o.hint && <Muted>{o.hint}</Muted>}
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 4 }} />;
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: c.background }}>
      <BookX size={44} color={c.mutedForeground} />
      <Body style={{ textAlign: "center" }}>{message}</Body>
      {onRetry && <Button title="Tekrar dene" onPress={onRetry} />}
    </View>
  );
}

export function Stat({ label, value, danger, icon: Icon }: { label: string; value: string | number; danger?: boolean; icon?: LucideIcon }) {
  const c = useColors();
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      {Icon && <Icon size={20} color={c.primary} />}
      <Label>{label}</Label>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: danger ? c.destructive : c.foreground }}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius + 6,
    padding: 16,
    gap: 10,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  button: { borderWidth: 1, borderRadius: radius + 2, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center", minHeight: 46 },
  buttonSmall: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 32 },
  input: { borderWidth: 1, borderRadius: radius + 2, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Poppins_400Regular", fontSize: 14 },
  segment: { flex: 1, borderWidth: 1.5, borderRadius: radius + 4, padding: 12, gap: 2 },
});
