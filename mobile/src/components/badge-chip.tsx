import { Snail, Sparkles } from "lucide-react-native";
import { memo } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fonts } from "@/lib/theme";
import type { BadgeTag } from "@/lib/types";

/**
 * Ismin yanındaki rozet. İyi rozet: yeşil, tam yuvarlak, parıltı simgeli.
 * Latife (kötü) rozet: turuncu, köşeli ve kesik çizgili çerçeve, salyangoz simgeli.
 */
export const BadgeChip = memo(function BadgeChip({ tag, big, struck, style }: { tag: BadgeTag; big?: boolean; struck?: boolean; style?: StyleProp<ViewStyle> }) {
  const good = tag.kind === "GOOD";
  const size = big ? 12 : 10;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          paddingHorizontal: big ? 8 : 6,
          paddingVertical: big ? 3 : 1,
          opacity: struck ? 0.55 : 1,
          flexShrink: 0,
        },
        good
          ? { backgroundColor: "#10b981", borderRadius: 99 }
          : { backgroundColor: "#fff7ed", borderRadius: 3, borderWidth: 1, borderStyle: "dashed", borderColor: "#fb923c" },
        style,
      ]}
    >
      {good ? <Sparkles size={size + 1} color="#fff" strokeWidth={2.5} /> : <Snail size={size + 1} color="#c2410c" strokeWidth={2.5} />}
      <Text style={{ fontFamily: good ? fonts.bold : fonts.semibold, fontSize: size, color: good ? "#fff" : "#9a3412", textDecorationLine: struck ? "line-through" : "none" }}>{tag.label}</Text>
    </View>
  );
});
