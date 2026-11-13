import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, useApiFetch } from "@/lib/api";
import { checkInbox, markInboxSeen, refreshInboxToken } from "@/lib/inbox";
import { pushActive, registerPushDevice } from "@/lib/push";
import { syncChrono } from "@/lib/chrono";
import { LITE } from "@/lib/variant";
import { getKazaStickyPref, syncKazaCard, type KazaState } from "@/lib/kaza";
import { exactAlarmsAllowed, handleReportAction, requestExactAlarms, setupNotifications, syncSchedule, type ReportData, SCHEDULE_PATH, setDayCards } from "@/lib/notifications";
import { fonts, useColors } from "@/lib/theme";
import type { MeResponse } from "@/lib/types";

/** Giriş yapılınca bildirimleri kurar, okuma planını cihaza işler ve bildirim tıklamalarını yönetir. */
export function NotificationBridge() {
  const router = useRouter();
  const fetcher = useApiFetch();
  const qc = useQueryClient();
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

  // Kilit ekranı kartı uygulamadaki gün kartlarıyla aynı kalsın; kronometre (açıksa) yerinde dursun
  useEffect(() => {
    if (!me.data?.groups) return;
    setDayCards(me.data.groups);
    syncChrono(me.data).catch(() => {});
  }, [me.data]);

  // Bildirim panelindeki kaza kartı: uygulama açılınca güncel sayılar ve yeni token ile yenilenir
  useEffect(() => {
    // Önbellekteki aynı sorgu kullanılır (Bugün sayfası da aynı veriyi istiyor: tek istek)
    getKazaStickyPref()
      .then(async (on) => (on ? syncKazaCard(await qc.fetchQuery({ queryKey: ["/api/m/kaza"], queryFn: () => fetcher<KazaState>("/api/m/kaza"), staleTime: 15_000 })) : undefined))
      .catch(() => {});
  }, [fetcher, qc]);

  // Okuma günleri/raporlar değiştikçe (me verisi tazelenince) planı güncelle
  useEffect(() => {
    if (ready && me.dataUpdatedAt) syncSchedule(() => fetcher(SCHEDULE_PATH)).catch(() => {});
  }, [ready, me.dataUpdatedAt, fetcher]);

  // Mesaj bildirimi için arka plan token'ı; uygulama açıkken görülen mesajlar sonradan bildirilmez
  useEffect(() => {
    refreshInboxToken(fetcher).catch(() => {});
    // Anlık bildirim için cihaz kaydı (Firebase ayarlıysa)
    registerPushDevice(fetcher).catch(() => {});
    markInboxSeen();
  }, [fetcher]);

  // Uygulama açıkken gruplara gelen mesajlar da bildirilir (açık olan sohbet hariç)
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (AppState.currentState !== "active") return;
      // Anlık bildirim çalışıyorsa mesajlar zaten anında geliyor: yedek kontrol 4 kat seyrek (pil ve veri)
      if (pushActive() && n++ % 4) return;
      checkInbox()
        .then((n) => {
          // Yeni mesaj geldi: menüdeki ve grup kartlarındaki okunmamış sayıları tazelenir
          if (!n) return;
          qc.invalidateQueries({ queryKey: ["/api/m/me"] });
          qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/api/m/groups?") });
        })
        .catch(() => {});
    }, LITE ? 60_000 : 30_000);
    return () => clearInterval(t);
  }, [qc]);

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
        ⏰ Okuma hatırlatmalarının tam zamanında gelmesi için &quot;Alarm ve hatırlatıcılar&quot; iznini ver. <Text style={{ fontFamily: fonts.bold }}>İzin ver →</Text>
      </Text>
    </Pressable>
  );
}
