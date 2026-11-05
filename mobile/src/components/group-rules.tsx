import { AlarmClock, BookOpen, Coins, MessagesSquare } from "lucide-react-native";
import { Text, View } from "react-native";
import { minuteToTime } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import { describePenalty, type Rules } from "@/lib/types";
import { Card, Muted } from "./ui";

export function GroupRules({ rules, startMinute, deadlineMinute, chatPolicy, title }: { rules: Rules; startMinute: number; deadlineMinute: number; chatPolicy?: "ALL" | "ADMINS"; title?: string }) {
  const c = useColors();
  const items: { Icon: typeof BookOpen; label: string; value: string; sub?: string }[] = [
    { Icon: BookOpen, label: "Günlük hedef", value: `${rules.targetPages} sayfa`, sub: `Alt sınır ${rules.minPages}` },
    { Icon: Coins, label: "Ceza", value: describePenalty(rules) },
    { Icon: AlarmClock, label: "Okuma günü", value: `${minuteToTime(startMinute)} – ${minuteToTime(deadlineMinute)}` },
    ...(chatPolicy ? [{ Icon: MessagesSquare, label: "Sohbet", value: chatPolicy === "ALL" ? "Herkes yazabilir" : "Yalnızca yöneticiler" }] : []),
  ];
  return (
    <View style={{ gap: 6 }}>
      {title && <Muted style={{ fontFamily: fonts.semibold }}>{title}</Muted>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.map(({ Icon, label, value, sub }) => (
          <Card key={label} style={{ width: "48.5%", padding: 12, gap: 2 }}>
            <Icon size={18} color={c.primary} />
            <Muted style={{ marginTop: 4 }}>{label}</Muted>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{value}</Text>
            {sub ? <Muted>{sub}</Muted> : null}
          </Card>
        ))}
      </View>
    </View>
  );
}
