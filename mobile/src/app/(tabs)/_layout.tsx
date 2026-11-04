import { Tabs } from "expo-router/js-tabs";
import { Text } from "react-native";
import { useApi } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import type { MeResponse } from "@/lib/types";

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const c = useColors();
  const me = useApi<MeResponse>("/api/m/me");
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: c.destructive, fontFamily: fonts.semibold, fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Bugün", tabBarIcon: icon("📖") }} />
      <Tabs.Screen name="groups" options={{ title: "Gruplar", tabBarIcon: icon("👥") }} />
      <Tabs.Screen name="notifications" options={{ title: "Bildirimler", tabBarIcon: icon("🔔"), tabBarBadge: me.data?.badge || undefined }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
