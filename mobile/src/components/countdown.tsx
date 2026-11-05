import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { formatDuration } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";

export function Countdown({ to, suffix = "kaldı", style }: { to: string; suffix?: string; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = new Date(to).getTime() - now;
  const urgent = left > 0 && left < 10 * 60_000;
  return (
    <Text style={[{ fontFamily: fonts.semibold, fontVariant: ["tabular-nums"], color: urgent ? c.destructive : c.foreground }, style]}>
      {left > 0 ? `${formatDuration(left)} ${suffix}` : "süre doldu"}
    </Text>
  );
}
