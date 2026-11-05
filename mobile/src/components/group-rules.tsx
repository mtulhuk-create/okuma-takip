import { AlarmClock, BookOpen, Coins, MessagesSquare } from "lucide-react-native";
import { Text, View } from "react-native";
import { minuteToTime } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import { booksOf, describePenalty, type Rules } from "@/lib/types";
import { Card, Muted, Row } from "./ui";

export function GroupRules({ rules, startMinute, deadlineMinute, chatPolicy, title }: { rules: Omit<Rules, "books"> & { books?: unknown }; startMinute: number; deadlineMinute: number; chatPolicy?: "ALL" | "ADMINS"; title?: string }) {
  const c = useColors();
  const books = booksOf(rules);
  const items: { Icon: typeof BookOpen; label: string; value: string }[] = [
    { Icon: Coins, label: "Ceza", value: describePenalty(rules) },
    { Icon: AlarmClock, label: "Okuma günü", value: `${minuteToTime(startMinute)} – ${minuteToTime(deadlineMinute)}` },
    ...(chatPolicy ? [{ Icon: MessagesSquare, label: "Sohbet", value: chatPolicy === "ALL" ? "Herkes yazabilir" : "Yalnızca yöneticiler" }] : []),
  ];
  return (
    <View style={{ gap: 6 }}>
      {title && <Muted style={{ fontFamily: fonts.semibold }}>{title}</Muted>}
      <Card style={{ padding: 12, gap: 6 }}>
        <Row gap={6}>
          <BookOpen size={15} color={c.primary} />
          <Muted style={{ fontFamily: fonts.semibold }}>Okunacak {books.length > 1 ? `${books.length} eser` : "eser"}</Muted>
        </Row>
        {books.map((b) => (
          <Row key={b.id} style={{ justifyContent: "space-between" }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>
              {b.title}
            </Text>
            <Muted>
              günde {b.targetPages} · alt sınır {b.minPages}
            </Muted>
          </Row>
        ))}
      </Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.map(({ Icon, label, value }) => (
          <Card key={label} style={{ width: "48.5%", padding: 12, gap: 2 }}>
            <Icon size={18} color={c.primary} />
            <Muted style={{ marginTop: 4 }}>{label}</Muted>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{value}</Text>
          </Card>
        ))}
      </View>
    </View>
  );
}
