import { router } from "expo-router";
import { ChevronRight, MoonStar } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { KAZA, sum } from "@/lib/kaza";
import { fonts, useColors } from "@/lib/theme";
import { fmt, PrayerGrid, StatsTable, UndoBar, useKaza } from "./kaza";
import { Card, Muted, Row } from "./ui";

/** Bugün sayfasında kaza gün kartı (kaza takibi açıksa okuma kartlarının altında) */
export function KazaDayCard() {
  const c = useColors();
  const { data, op } = useKaza();
  if (!data?.enabled) return null;
  return (
    <Card style={{ gap: 12 }}>
      <Pressable onPress={() => router.push("/kaza")}>
        <Row gap={10}>
          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: KAZA, alignItems: "center", justifyContent: "center" }}>
            <MoonStar size={17} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: c.foreground }}>Namaz kaza</Text>
            <Muted>
              {fmt(sum(data.remaining))} kalan · bugün {data.dailyGoal ? `${data.today}/${data.dailyGoal}` : data.today}
            </Muted>
          </View>
          <ChevronRight size={18} color={c.mutedForeground} />
        </Row>
      </Pressable>
      <StatsTable s={data} compact />
      <PrayerGrid s={data} op={op} compact />
      <UndoBar op={op} />
      <Muted style={{ fontSize: 10.5, textAlign: "center" }}>− kıldım (kalandan düşer) · + kaçırdım (kazaya ekler)</Muted>
    </Card>
  );
}
