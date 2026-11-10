import { useClerk } from "@clerk/expo";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { AppState, Linking, Platform, Switch, Text, View } from "react-native";
import { AppIconPicker } from "@/components/app-icon-picker";
import { NameSheet } from "@/components/name-sheet";
import { Avatar, Body, Button, Card, ErrorView, H1, Loading, Muted, Row, Screen, Segmented, Stat, Title } from "@/components/ui";
import { toast, useApi, useApiFetch } from "@/lib/api";
import { LITE } from "@/lib/variant";
import { exactAlarmsAllowed, getLastSync, getStickyPref, requestExactAlarms, scheduledSummary, sendTestNotification, setStickyPref, setupNotifications, syncSchedule, SCHEDULE_PATH } from "@/lib/notifications";
import { useThemePref } from "@/lib/theme-pref";
import { setKazaStickyPref } from "@/lib/kaza";
import { getMessagePref, markInboxSeen, setMessagePref } from "@/lib/inbox";
import { hideAllDayCardNotifications, hideKazaNotification, scheduleDayCardNotificationsJson } from "../../../modules/day-card-notification";
import { Bell, BookOpen, CalendarCheck, LogOut, Monitor, Moon, Palette, Pencil, Sun, Users, Wallet } from "lucide-react-native";
import { fonts, useColors } from "@/lib/theme";
import type { ProfileResponse } from "@/lib/types";
import { showAlert } from "@/lib/dialog";

export default function ProfileScreen() {
  const { signOut } = useClerk();
  const { data, isLoading, error, refetch, isRefetching } = useApi<ProfileResponse>("/api/m/profile");
  const [perm, setPerm] = useState<{ notif: boolean; exact: boolean } | null>(null);
  const { pref, setPref } = useThemePref();
  const [editName, setEditName] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [msgNotify, setMsgNotify] = useState(true);
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
    getMessagePref().then((v) => alive && setMsgNotify(v));
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
    if (resync) await syncSchedule(() => fetcher(SCHEDULE_PATH)).catch(() => {});
    const sum = await scheduledSummary();
    setStatus({ ...sum, error: getLastSync()?.error ?? null });
  }

  async function enableNotifications() {
    await setupNotifications().catch(() => {});
    const r = await Notifications.getPermissionsAsync();
    if (!r.granted) {
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) {
        showAlert("Bildirim izni kapalı", "Telefon ayarlarında Okuma Takip için “Bildirimlere izin ver”i aç. Sonra uygulamaya geri dön.", [
          { text: "Vazgeç", style: "cancel" },
          { text: "Ayarları aç", onPress: () => Linking.openSettings() },
        ]);
      }
    }
    await checkPerms();
    // Planı hemen cihaza işle
    syncSchedule(() => fetcher(SCHEDULE_PATH)).catch(() => {});
  }

  if (isLoading) return <Loading />;
  if (!data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const s = data.stats;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row gap={12}>
        <Avatar name={data.user.name} uri={data.user.imageUrl} initial={data.user.initial} seed={data.user.id} size={56} />
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
        <AppIconPicker />
      </Card>

      <Card>
        <Row>
          <Bell size={18} color={c.primary} />
          <Title>Bildirimler</Title>
        </Row>
        <Body>
          Telefonuna yalnızca üç tür bildirim gelir: kilit ekranındaki sabit gün/kaza kartı, okuma hatırlatmaları (grubun belirlediği saatte ve son 10 dakikada) ve gruplara yazılan mesajlar.
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
              <Muted>Gün kartın okuma günü boyunca kilit ekranında ve bildirim panelinde durur: kalan süre, kaç kişinin okuduğu ve renkli butonlarla uygulamayı açmadan bildir. Gün bitince kalkar.</Muted>
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
        {perm?.notif && (
          <Row style={{ justifyContent: "space-between", borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Grup mesajları</Text>
              <Muted>Okuyucuların grup sohbetine yazdığı mesajlar, fotoğraflar ve anketler bildirim olarak gelir. Uygulama kapalıyken telefon izin verdikçe (yaklaşık 15 dakikada bir) kontrol edilir.</Muted>
            </View>
            <Switch
              value={msgNotify}
              onValueChange={async (v) => {
                setMsgNotify(v);
                await setMessagePref(v);
                if (v) markInboxSeen();
              }}
              trackColor={{ true: c.primary, false: c.muted }}
              thumbColor="#fff"
            />
          </Row>
        )}
        {perm?.notif && Platform.OS === "android" && (
          // Samsung vb. pil tasarrufu uygulamayı uyutursa hatırlatmalar gecikir ya da hiç gelmez
          <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Pil tasarrufu</Text>
            <Muted>Bildirimler gecikiyor ya da gelmiyorsa pil ayarlarında Okuma Takip&apos;i &quot;Asla uyutma&quot; / &quot;Kısıtlama yok&quot; olarak ayarla.</Muted>
            <Button
              title="Pil ayarlarını aç"
              small
              variant="ghost"
              onPress={() => Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS").catch(() => Linking.openSettings())}
            />
          </View>
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
              const day = await sendTestNotification(() => fetcher(SCHEDULE_PATH));
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
          showAlert("Çıkış yap", "Hesabından çıkmak istiyor musun?", [
            { text: "Vazgeç", style: "cancel" },
            {
              text: "Çıkış yap",
              style: "destructive",
              onPress: async () => {
                await Notifications.cancelAllScheduledNotificationsAsync();
                // Kilit ekranı ve kaza kartları başka hesaba geçmesin
                hideAllDayCardNotifications();
                scheduleDayCardNotificationsJson("[]");
                hideKazaNotification();
                await setKazaStickyPref(false);
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
