import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, useApiFetch } from "@/lib/api";
import { markInboxSeen, refreshInboxToken } from "@/lib/inbox";
import { exactAlarmsAllowed, handleReportAction, requestExactAlarms, setupNotifications, syncSchedule, type ReportData } from "@/lib/notifications";
import { fonts, useColors } from "@/lib/theme";
import type { MeResponse } from "@/lib/types";

/** Giriş yapılınca bildirimleri kurar, okuma planını cihaza işler ve bildirim tıklamalarını yönetir. */
export function NotificationBridge() {
  const router = useRouter();
  const fetcher = useApiFetch();
  const me = useApi<MeResponse>("/api/m/me");
  const [ready, setReady] = useState(false);
  const [exactDenied, setExactDenied] = useState(false);
  const c = useColors();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setupNotifications()
      .then(async () => {
        setExactDenied(!(await exactAlarmsAllowed()));
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  // Okuma günleri/raporlar değiştikçe (me verisi tazelenince) planı güncelle
  useEffect(() => {
    if (ready && me.dataUpdatedAt) syncSchedule(() => fetcher("/api/me/schedule")).catch(() => {});
  }, [ready, me.dataUpdatedAt, fetcher]);

  // Mesaj bildirimi için arka plan token'ı; uygulama açıkken görülen mesajlar sonradan bildirilmez
  useEffect(() => {
    refreshInboxToken(fetcher).catch(() => {});
    markInboxSeen();
  }, [fetcher]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") me.refetch();
      if (s === "active" || s === "background") markInboxSeen();
    });
    return () => sub.remove();
  }, [me]);

  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const data = last.notification.request.content.data as Partial<ReportData>;
    if (last.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      if (data?.groupId) router.push(`/group/${data.groupId}`);
    } else if (data?.token) {
      const key = `${last.notification.request.identifier}:${last.actionIdentifier}:${last.notification.date}`;
      handleReportAction(last.actionIdentifier, data as ReportData, last.userText, key).then(() => me.refetch());
    }
    Notifications.clearLastNotificationResponse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  if (!exactDenied) return null;
  return (
    <Pressable
      onPress={async () => {
        await requestExactAlarms();
        setExactDenied(!(await exactAlarmsAllowed()));
      }}
      style={{ position: "absolute", zIndex: 100, top: insets.top + 6, left: 12, right: 12, backgroundColor: c.warningBg, borderRadius: 10, padding: 12, elevation: 6 }}
    >
      <Text style={{ fontFamily: fonts.medium, color: c.warning, fontSize: 13 }}>
        ⏰ Geri sayım bildirimlerinin tam zamanında gelmesi için &quot;Alarm ve hatırlatıcılar&quot; iznini ver. <Text style={{ fontFamily: fonts.bold }}>İzin ver →</Text>
      </Text>
    </Pressable>
  );
}
