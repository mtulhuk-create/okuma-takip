import { Tabs } from "expo-router/js-tabs";
import { Bell, BookOpen, User, Users, type LucideIcon } from "lucide-react-native";
import { useApi } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import type { MeResponse } from "@/lib/types";

const icon = (Icon: LucideIcon) =>
  function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return <Icon size={23} color={String(color)} strokeWidth={focused ? 2.4 : 2} />;
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
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, height: 62, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: c.destructive, fontFamily: fonts.semibold, fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Bugün", tabBarIcon: icon(BookOpen) }} />
      <Tabs.Screen name="groups" options={{ title: "Gruplar", tabBarIcon: icon(Users) }} />
      <Tabs.Screen name="notifications" options={{ title: "Bildirimler", tabBarIcon: icon(Bell), tabBarBadge: me.data?.badge || undefined }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: icon(User) }} />
    </Tabs>
  );
}
