import { AlarmClockOff, CalendarClock, Hourglass, ShieldAlert, type LucideIcon } from "lucide-react-native";
import { Text } from "react-native";
import { formatDateTime } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { DueInfo } from "@/lib/types";
import { Countdown } from "./countdown";
import { Row } from "./ui";

/**
 * Borcun yanında vade: son tarih + kalan süre.
 * Ek süre verildiyse sarı kum saati, vade dolduysa kırmızı uyarı ve karar süresi.
 */
export function DueBadge({ due, compact }: { due: DueInfo; compact?: boolean }) {
  const c = useColors();
  const extended = (due.extensions ?? 0) > 0;
  let Icon: LucideIcon = CalendarClock;
  let color = c.foreground;
  let bg = c.muted;
  let label: string | null = null;
  if (due.status === "OVERDUE") {
    Icon = AlarmClockOff;
    color = c.destructive;
    bg = c.destructive + "1f";
    label = "Vade doldu";
  } else if (due.status === "SUBMITTED") {
    Icon = ShieldAlert;
    color = c.info;
    bg = c.info + "1f";
    label = "Ödeme bildirildi · onay bekliyor";
  } else if (extended) {
    Icon = Hourglass;
    color = c.warning;
    bg = "#f59e0b26";
    label = `Ek süre${(due.extensions ?? 0) > 1 ? ` ×${due.extensions}` : ""}`;
  }
  return (
    <Row gap={4} style={{ alignSelf: "flex-start", flexWrap: "wrap", backgroundColor: bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Icon size={12} color={color} />
      {label && <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color }}>{label}</Text>}
      {due.status === "OVERDUE" ? (
        due.decisionUntil && !compact ? (
          <>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color }}>· karar için</Text>
            <Countdown to={due.decisionUntil} suffix="" style={{ fontSize: 11 }} />
          </>
        ) : null
      ) : due.status === "SUBMITTED" ? null : (
        <>
          {label && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color }}>·</Text>}
          {!compact && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color }}>{formatDateTime(due.dueAt)} ·</Text>}
          <Countdown to={due.dueAt} style={{ fontSize: 11 }} />
        </>
      )}
    </Row>
  );
}
