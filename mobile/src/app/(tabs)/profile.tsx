import { useClerk } from "@clerk/expo";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { Avatar, Body, Button, Card, ErrorView, H1, Loading, Muted, Row, Screen, Stat, Title } from "@/components/ui";
import { useApi } from "@/lib/api";
import { exactAlarmsAllowed, requestExactAlarms } from "@/lib/notifications";
import type { ProfileResponse } from "@/lib/types";

export default function ProfileScreen() {
  const { signOut } = useClerk();
  const { data, isLoading, error, refetch, isRefetching } = useApi<ProfileResponse>("/api/m/profile");
  const [perm, setPerm] = useState<{ notif: boolean; exact: boolean } | null>(null);

  async function checkPerms() {
    const n = await Notifications.getPermissionsAsync();
    setPerm({ notif: n.granted, exact: await exactAlarmsAllowed() });
  }
  useEffect(() => {
    checkPerms();
  }, []);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const s = data.stats;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row gap={12}>
        <Avatar name={data.user.name} uri={data.user.imageUrl} size={56} />
        <View style={{ flex: 1 }}>
          <H1>{data.user.name}</H1>
          {data.user.username && <Muted>@{data.user.username}</Muted>}
        </View>
      </Row>
      <Row gap={12}>
        <Stat label="Toplam sayfa" value={s.totalPages} />
        <Stat label="Okunan gün" value={s.readDays} />
      </Row>
      <Row gap={12}>
        <Stat label="Toplam ceza" value={`${s.totalPenalty} TL`} />
        <Stat label="Aktif grup" value={s.activeGroups} />
      </Row>

      <Card>
        <Title>🔔 Bildirimler</Title>
        <Body>
          Uyarılar grubun belirlediği saatte, geri sayım ise son bildirim saatinden 10 dakika önce başlar. Bildirimdeki butonlarla uygulamayı açmadan okumanı bildirebilirsin.
        </Body>
        {perm && !perm.notif && (
          <Button
            title="Bildirim izni ver"
            onPress={async () => {
              const r = await Notifications.requestPermissionsAsync();
              if (!r.granted && !r.canAskAgain) Linking.openSettings();
              checkPerms();
            }}
          />
        )}
        {perm && perm.notif && !perm.exact && (
          <Button
            title="Tam zamanlı alarm izni ver"
            variant="ghost"
            onPress={async () => {
              await requestExactAlarms();
              checkPerms();
            }}
          />
        )}
        {perm?.notif && perm.exact && <Body style={{ color: "#047857" }}>✓ Bildirimler açık ve tam zamanında gelecek.</Body>}
      </Card>

      <Muted>
        Diğer kullanıcılar seni davet etmek için adınla ya da kullanıcı adınla arayabilir. {data.user.email ? `Hesap: ${data.user.email}` : ""}
      </Muted>

      <Button
        title="Çıkış yap"
        variant="ghost"
        textColor="#991b1b"
        onPress={() =>
          Alert.alert("Çıkış yap", "Hesabından çıkmak istiyor musun?", [
            { text: "Vazgeç", style: "cancel" },
            {
              text: "Çıkış yap",
              style: "destructive",
              onPress: async () => {
                await Notifications.cancelAllScheduledNotificationsAsync();
                await signOut();
              },
            },
          ])
        }
      />
      <Muted style={{ textAlign: "center" }}>Okuma Takip v{Application.nativeApplicationVersion ?? "1.0.0"}</Muted>
    </Screen>
  );
}
