import { useClerk } from "@clerk/expo";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, AppState, Linking, Switch, Text, View } from "react-native";
import { NameSheet } from "@/components/name-sheet";
import { Avatar, Body, Button, Card, ErrorView, H1, Loading, Muted, Row, Screen, Segmented, Stat, Title } from "@/components/ui";
import { toast, useApi, useApiFetch } from "@/lib/api";
import { LITE } from "@/lib/variant";
import { exactAlarmsAllowed, getLastSync, getStickyPref, requestExactAlarms, scheduledSummary, sendTestNotification, setStickyPref, setupNotifications, syncSchedule } from "@/lib/notifications";
import { useThemePref } from "@/lib/theme-pref";
import { Bell, BookOpen, CalendarCheck, LogOut, Monitor, Moon, Palette, Pencil, Sun, Users, Wallet } from "lucide-react-native";
import { fonts, useColors } from "@/lib/theme";
import type { ProfileResponse } from "@/lib/types";

export default function ProfileScreen() {
  const { signOut } = useClerk();
  const { data, isLoading, error, refetch, isRefetching } = useApi<ProfileResponse>("/api/m/profile");
  const [perm, setPerm] = useState<{ notif: boolean; exact: boolean } | null>(null);
  const { pref, setPref } = useThemePref();
  const [editName, setEditName] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [status, setStatus] = useState<{ count: number; next: Date | null; error: string | null } | null>(null);
  const c = useColors();

  async function checkPerms() {
    const n = await Notifications.getPermissionsAsync();
    setPerm({ notif: n.granted, exact: await exactAlarmsAllowed() });
  }
  const fetcher = useApiFetch();
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const n = await Notifications.getPermissionsAsync();
      const exact = await exactAlarmsAllowed();
      if (alive) setPerm({ notif: n.granted, exact });
    };
    check();
    getStickyPref().then((v) => alive && setSticky(v));
    refreshStatus();
    // Telefon ayarlarından dönünce izinleri yeniden kontrol et
    const sub = AppState.addEventListener("change", (st) => st === "active" && check());
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  /** Planı sunucudan alıp cihaza yeniden işler ve durumu gösterir */
  async function refreshStatus(resync = false) {
    if (resync) await syncSchedule(() => fetcher("/api/me/schedule")).catch(() => {});
    const sum = await scheduledSummary();
    setStatus({ ...sum, error: getLastSync()?.error ?? null });
  }

  async function enableNotifications() {
    await setupNotifications().catch(() => {});
    const r = await Notifications.getPermissionsAsync();
    if (!r.granted) {
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) {
        Alert.alert("Bildirim izni kapalı", "Telefon ayarlarında Okuma Takip için “Bildirimlere izin ver”i aç. Sonra uygulamaya geri dön.", [
          { text: "Vazgeç", style: "cancel" },
          { text: "Ayarları aç", onPress: () => Linking.openSettings() },
        ]);
      }
    }
    await checkPerms();
    // Planı hemen cihaza işle
    syncSchedule(() => fetcher("/api/me/schedule")).catch(() => {});
  }

  if (isLoading) return <Loading />;
  if (!data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const s = data.stats;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row gap={12}>
        <Avatar name={data.user.name} uri={data.user.imageUrl} size={56} />
        <View style={{ flex: 1 }}>
          <H1>{data.user.name}</H1>
          {data.user.username && <Muted>@{data.user.username}</Muted>}
        </View>
        <Button title="Düzenle" icon={Pencil} variant="ghost" small onPress={() => setEditName(true)} />
      </Row>
      <NameSheet visible={editName} name={data.user.name} onClose={() => setEditName(false)} />
      <Row gap={12}>
        <Stat icon={BookOpen} label="Toplam sayfa" value={s.totalPages} />
        <Stat icon={CalendarCheck} label="Okunan gün" value={s.readDays} />
      </Row>
      <Row gap={12}>
        <Stat icon={Wallet} label="Toplam ceza" value={`${s.totalPenalty} TL`} />
        <Stat icon={Users} label="Aktif grup" value={s.activeGroups} />
      </Row>

      <Card>
        <Row>
          <Palette size={18} color={c.primary} />
          <Title>Görünüm</Title>
        </Row>
        <Segmented
          value={pref}
          onChange={setPref}
          options={[
            { value: "light", label: "Açık", icon: Sun },
            { value: "dark", label: "Koyu", icon: Moon },
            { value: "system", label: "Sistem", icon: Monitor },
          ]}
        />
      </Card>

      <Card>
        <Row>
          <Bell size={18} color={c.primary} />
          <Title>Bildirimler</Title>
        </Row>
        <Body>
          Her okuma günü başlarken gün kartı bildirimi gelir; uyarı grubun belirlediği saatte, geri sayım son 10 dakikada başlar. Bildirimdeki Okudum / Alt sınır / Okumadım butonlarıyla uygulamayı açmadan bildirebilirsin.
        </Body>
        {perm && !perm.notif && <Button title="Bildirimleri aç" onPress={enableNotifications} />}
        {perm && perm.notif && !perm.exact && (
          <Button
            title="Tam zamanlı alarm izni ver"
            variant="ghost"
            onPress={async () => {
              await requestExactAlarms().catch(() => Linking.openSettings());
              checkPerms();
            }}
          />
        )}
        {perm?.notif && perm.exact && <Body style={{ color: c.success }}>Bildirimler açık ve tam zamanında gelecek.</Body>}
        {perm?.notif && !LITE && (
          <Row style={{ justifyContent: "space-between", borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Bugünün kartı kilit ekranında</Text>
              <Muted>Okuma günü boyunca bildirim panelinde ve kilit ekranında sabit durur; bildirince kalkar.</Muted>
            </View>
            <Switch
              value={sticky}
              onValueChange={async (v) => {
                setSticky(v);
                await setStickyPref(v);
                await setupNotifications().catch(() => {});
                await refreshStatus(true);
              }}
              trackColor={{ true: c.primary, false: c.muted }}
              thumbColor="#fff"
            />
          </Row>
        )}
        {perm?.notif && status && (
          <View style={{ backgroundColor: c.muted, borderRadius: 10, padding: 10, gap: 2 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.foreground }}>
              Bu cihazda planlı {status.count} bildirim
              {status.next ? ` · sıradaki ${status.next.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
            </Text>
            {status.error ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.destructive }}>{status.error}</Text> : null}
            {status.count === 0 && !status.error ? <Muted style={{ fontSize: 11 }}>Bugün için bildirecek okuma kalmadıysa normaldir.</Muted> : null}
            <Text onPress={() => refreshStatus(true)} style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.primary, marginTop: 2 }}>
              Yeniden planla
            </Text>
          </View>
        )}
        {perm?.notif && (
          <Button
            title="Deneme bildirimi gönder"
            variant="ghost"
            icon={Bell}
            onPress={async () => {
              await setupNotifications().catch(() => {});
              const day = await sendTestNotification(() => fetcher("/api/me/schedule"));
              toast(day ? "Gün kartı bildirimi gönderildi" : "Deneme bildirimi gönderildi");
            }}
          />
        )}
      </Card>

      <Muted>
        Diğer kullanıcılar seni davet etmek için adınla ya da kullanıcı adınla arayabilir. {data.user.email ? `Hesap: ${data.user.email}` : ""}
      </Muted>

      <Button
        title="Çıkış yap"
        icon={LogOut}
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
      <Muted style={{ textAlign: "center" }}>
        Okuma Takip{LITE ? " Lite" : ""} v{Application.nativeApplicationVersion ?? "1.0.0"}
        {LITE ? "\nLite sürüm · eski telefonlar için, yönetici özellikleri yok" : ""}
      </Muted>
    </Screen>
  );
}
