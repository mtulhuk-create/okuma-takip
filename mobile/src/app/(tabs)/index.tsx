import { router } from "expo-router";
import { CalendarDays, CloudOff, Plus, Receipt, Search } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { DayCardMini } from "@/components/day-card";
import { MyHistorySection } from "@/components/history";
import { DebtButton } from "@/components/pay-sheet";
import { DueBadge } from "@/components/due-badge";
import { KazaDayCard } from "@/components/kaza-day-card";
import { Avatar, Button, Card, ErrorView, H1, Loading, Muted, Row, Screen, Title } from "@/components/ui";
import { useApi } from "@/lib/api";
import { LITE } from "@/lib/variant";
import { fonts, useColors } from "@/lib/theme";
import type { MeResponse } from "@/lib/types";

export default function TodayScreen() {
  const c = useColors();
  const { data, isLoading, error, refetch, isRefetching } = useApi<MeResponse>("/api/m/me");
  if (isLoading) return <Loading />;
  if (!data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Muted>Merhaba,</Muted>
          <H1 numberOfLines={1}>{data.user.name}</H1>
        </View>
        <Row gap={8}>
          <DebtButton total={data.money.unpaidTotal} items={data.money.debts ?? []} />
          <Pressable onPress={() => router.push("/profile")}>
            <Avatar name={data.user.name} uri={data.user.imageUrl} initial={data.user.initial} seed={data.user.id} size={42} />
          </Pressable>
        </Row>
      </Row>

      {error && (
        <Row gap={6} style={{ backgroundColor: c.warning + "1f", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <CloudOff size={14} color={c.warning} />
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: c.warning }}>İnternet yok · son kaydedilen veriler gösteriliyor. Gün kartında işaretleme yapabilirsin; bağlanınca gönderilir.</Text>
        </Row>
      )}
      <MyHistorySection />

      {data.money.dues.map((d) => (
        <Pressable key={d.id} onPress={() => router.push(`/group/${d.groupId}/info`)}>
          <Card tone="danger" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Receipt size={22} color={c.destructive} />
            <View style={{ flex: 1 }}>
              <Title style={{ fontSize: 14 }}>
                {d.group.name} · {d.amount} TL ödeme
              </Title>
              <DueBadge due={d} />
            </View>
          </Card>
        </Pressable>
      ))}

      {data.groups.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <CalendarDays size={40} color={c.primary} />
          <Title>Henüz bir okuma grubunda değilsin</Title>
          <Muted style={{ textAlign: "center" }}>{LITE ? "Herkese açık gruplara katıl ya da davet bekle." : "Bir grup kur ya da herkese açık gruplara katıl."}</Muted>
          <Row>
            {!LITE && <Button title="Grup kur" icon={Plus} onPress={() => router.push("/group/new")} />}
            <Button title="Keşfet" icon={Search} variant="ghost" onPress={() => router.push("/groups")} />
          </Row>
        </Card>
      ) : (
        <>
          <Muted style={{ fontFamily: fonts.bold }}>Bugünün okumaları</Muted>
          {data.groups.map((g) => (
            <DayCardMini key={g.group.id} card={g.card} groupId={g.group.id} groupName={g.group.name} />
          ))}
        </>
      )}
      <KazaDayCard />
    </Screen>
  );
}
