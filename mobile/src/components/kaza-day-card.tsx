import { router } from "expo-router";
import { ChevronRight, MoonStar } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { KAZA, sum } from "@/lib/kaza";
import { fonts, useColors } from "@/lib/theme";
import { fmt, PrayerStrip, UndoBar, useKaza } from "./kaza";
import { Card, Row } from "./ui";

/** Bugün sayfasında kaza kartı (kaza takibi açıksa okuma kartlarının altında): kalan, bugün ve vakitlerde − / + */
export function KazaDayCard() {
  const c = useColors();
  const { data, op } = useKaza();
  if (!data?.enabled) return null;
  return (
    <Card style={{ gap: 10, padding: 12 }}>
      <Pressable onPress={() => router.push("/kaza")} hitSlop={4}>
        <Row gap={8}>
          <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: KAZA, alignItems: "center", justifyContent: "center" }}>
            <MoonStar size={13} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Namaz kaza</Text>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>
            {fmt(sum(data.remaining))} kalan
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: KAZA }}>bugün {data.dailyGoal ? `${data.today}/${data.dailyGoal}` : data.today}</Text>
          <ChevronRight size={16} color={c.mutedForeground} />
        </Row>
      </Pressable>
      <PrayerStrip s={data} op={op} />
      <UndoBar op={op} />
    </Card>
  );
}
