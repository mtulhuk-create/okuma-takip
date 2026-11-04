import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
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
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, paddingTop: padTop ? insets.top + 12 : 16, paddingBottom: 40, gap: 14 }}
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

export function H1({ children, style }: TextProps) {
  const c = useColors();
  return <Text style={[{ fontFamily: fonts.serif, fontSize: 24, color: c.foreground }, style]}>{children}</Text>;
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
}: {
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
        <Text style={{ fontFamily: fonts.semibold, fontSize: small ? 12 : 14, color: textColor ?? v.fg, textAlign: "center" }}>{title}</Text>
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

export function Avatar({ name, uri, size = 36 }: { name: string; uri?: string | null; size?: number }) {
  const c = useColors();
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: c.accentForeground }}>{initials}</Text>
    </View>
  );
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[] }) {
  const c = useColors();
  return (
    <Row gap={8}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.accent : c.card }]}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? c.accentForeground : c.foreground }}>{o.label}</Text>
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
      <Text style={{ fontSize: 44 }}>📕</Text>
      <Body style={{ textAlign: "center" }}>{message}</Body>
      {onRetry && <Button title="Tekrar dene" onPress={onRetry} />}
    </View>
  );
}

export function Stat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  const c = useColors();
  return (
    <Card style={{ flex: 1 }}>
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
