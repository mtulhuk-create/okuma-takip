import { memo, useSyncExternalStore } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { formatDuration, formatDurationShort } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import { LITE } from "@/lib/variant";

// Lite: saniye gösterilmez, sayaçlar 30 saniyede bir güncellenir (eski telefonları yormasın)
const TICK_MS = LITE ? 30_000 : 1000;

// Tüm geri sayımlar tek bir saniyelik zamanlayıcıyı paylaşır (eski cihazlarda her sayaç için ayrı
// zamanlayıcı çalıştırmak kasma yapıyordu). Ekranda sayaç kalmayınca zamanlayıcı durur.
const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((f) => f());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const getNow = () => now;

export const Countdown = memo(function Countdown({ to, suffix = "kaldı", style }: { to: string; suffix?: string; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  const t = useSyncExternalStore(subscribe, getNow);
  const left = new Date(to).getTime() - t;
  const urgent = left > 0 && left < 10 * 60_000;
  return (
    <Text style={[{ fontFamily: fonts.semibold, fontVariant: ["tabular-nums"], color: urgent ? c.destructive : c.foreground }, style]}>
      {left > 0 ? `${LITE ? formatDurationShort(left) : formatDuration(left)} ${suffix}` : "süre doldu"}
    </Text>
  );
});
