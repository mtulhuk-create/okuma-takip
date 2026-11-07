import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { BarChart3, CalendarRange, ChevronDown, Info, Landmark, Lock, SendHorizontal, Settings } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BadgeCard } from "@/components/chat/badge-card";
import { MessageBubble } from "@/components/chat/message";
import { PollModal } from "@/components/chat/poll-modal";
import { DayCardFull, DayShortcut } from "@/components/day-card";
import { Countdown } from "@/components/countdown";
import { DueBadge } from "@/components/due-badge";
import { PaySheet } from "@/components/pay-sheet";
import { GroupHistoryModal } from "@/components/history";
import { JoinView } from "@/components/join-view";
import { ErrorView, Loading, Row } from "@/components/ui";
import { ApiError, useAction, useApiFetch } from "@/lib/api";
import { formatDayLong } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { ChatMessage, ChatResponse } from "@/lib/types";

const trDay = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
function dayLabel(day: string) {
  if (day === trDay(new Date().toISOString())) return "Bugün";
  if (day === trDay(new Date(Date.now() - 86_400_000).toISOString())) return "Dün";
  return formatDayLong(day);
}

/** Hafif desenli sohbet duvar kağıdı (bir kez çizilir) */
const ChatWallpaper = memo(function ChatWallpaper() {
  const c = useColors();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="doodle" width={72} height={72} patternUnits="userSpaceOnUse">
          <Path d="M10 14h8a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2h-9zM32 14h-8a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h9z" stroke={c.chatPattern} strokeWidth={1.4} fill="none" />
          <Path d="M50 46l3 6 6 1-4.5 4.5 1 6-5.5-3-5.5 3 1-6L41 53l6-1z" stroke={c.chatPattern} strokeWidth={1.4} fill="none" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#doodle)" />
    </Svg>
  );
});

const DaySeparator = memo(function DaySeparator({ dayKey }: { dayKey: string }) {
  const c = useColors();
  return (
    <View style={{ alignSelf: "center", backgroundColor: c.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginVertical: 10, elevation: 1 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5, color: c.mutedForeground }}>{dayLabel(dayKey).toLocaleUpperCase("tr-TR")}</Text>
    </View>
  );
});

/** Mesaj yazma alanı: yazılan metin yalnızca burada tutulur, sohbet listesi her harfte yeniden çizilmez */
function Composer({ canPost, onSend, onPoll }: { canPost: boolean; onSend: (text: string) => void; onPoll: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    onSend(body);
  };
  return (
    <View style={{ backgroundColor: c.chatBg, paddingHorizontal: 6, paddingTop: 6, paddingBottom: Math.max(6, insets.bottom) }}>
      {canPost ? (
        <Row gap={6} style={{ alignItems: "flex-end" }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", backgroundColor: c.card, borderRadius: 24, paddingLeft: 4, elevation: 1 }}>
            <Pressable onPress={onPoll} hitSlop={6} accessibilityLabel="Anket oluştur" style={{ width: 40, height: 46, alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={21} color={c.mutedForeground} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Mesaj"
              placeholderTextColor={c.mutedForeground}
              multiline
              maxLength={2000}
              style={{ flex: 1, maxHeight: 120, minHeight: 46, paddingRight: 14, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, color: c.foreground }}
            />
          </View>
          <Pressable onPress={send} disabled={!text.trim()} accessibilityLabel="Gönder" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary, opacity: text.trim() ? 1 : 0.6, alignItems: "center", justifyContent: "center", elevation: 2 }}>
            <SendHorizontal size={20} color={c.primaryForeground} />
          </Pressable>
        </Row>
      ) : (
        <Row style={{ justifyContent: "center", paddingVertical: 10, backgroundColor: c.card, borderRadius: 24 }} gap={6}>
          <Lock size={15} color={c.mutedForeground} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: c.mutedForeground }}>Bu grupta yalnızca yöneticiler mesaj gönderebilir</Text>
        </Row>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const { id, day } = useLocalSearchParams<{ id: string; day?: string }>();
  const c = useColors();
  const fetcher = useApiFetch();
  const action = useAction();
  const chat = useQuery({ queryKey: [`/api/m/groups/${id}/chat`], queryFn: () => fetcher<ChatResponse>(`/api/m/groups/${id}/chat`), retry: (n, e) => !(e instanceof ApiError) && n < 2 });
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [kasaOpen, setKasaOpen] = useState(false);
  const [cardVisible, setCardVisible] = useState(true);
  const qc = useQueryClient();
  const list = useRef<FlatList<ChatMessage>>(null);
  const cursor = useRef(0);
  const scrolledToDay = useRef(false);
  const loadingOlder = useRef(false);

  useEffect(() => {
    if (chat.data && !cursor.current) cursor.current = chat.data.cursor;
  }, [chat.data]);

  // Gerçek zamanlı: ekran açıkken 2 saniyede bir yeni olay var mı bak
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const tick = async () => {
        if (!active || AppState.currentState !== "active" || !cursor.current) return;
        try {
          const res = await fetcher<{ cursor: number; events: unknown[] }>(`/api/m/groups/${id}/events?once=1&after=${cursor.current}`);
          cursor.current = res.cursor;
          if (res.events.length) {
            chat.refetch();
            // Ayar, üyelik ya da ödeme değiştiyse ilgili ekranlar da tazelensin
            if (res.events.some((e) => (e as { type?: string }).type !== "message")) {
              qc.invalidateQueries({ queryKey: ["/api/m/me"] });
              qc.invalidateQueries({ queryKey: [`/api/m/groups/${id}`] });
            }
          }
        } catch {}
      };
      const t = setInterval(tick, 3000);
      return () => {
        active = false;
        clearInterval(t);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, fetcher]),
  );

  const latest = chat.data?.messages;
  const messages = useMemo(() => {
    if (!latest) return [...older, ...pending];
    const first = latest[0]?.createdAt;
    const old = first ? older.filter((m) => m.createdAt < first) : older;
    const stillPending = pending.filter((p) => !latest.some((m) => m.text === p.text && m.user?.id === p.user?.id && m.createdAt >= p.createdAt));
    return [...old, ...latest, ...stillPending];
  }, [latest, older, pending]);
  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const dayIndex = day ? reversed.findIndex((m) => m.kind === "DAY" && m.day?.dayKey === day) : -1;

  // Bugün ekranından gelindiyse ilgili gün kartına kaydır
  useEffect(() => {
    if (dayIndex < 0 || scrolledToDay.current) return;
    scrolledToDay.current = true;
    const t = setTimeout(() => list.current?.scrollToIndex({ index: dayIndex, viewPosition: 0.4, animated: true }), 300);
    return () => clearTimeout(t);
  }, [dayIndex]);

  // Bugünün gün kartı ekranda değilse başlığın altında kısayol göster
  // Sunucu bugünün kartını göndermiyorsa (eski sürüm) sohbetteki en son gün kartı kullanılır
  const lastDayCard = useMemo(() => reversed.find((m) => m.kind === "DAY" && m.day)?.day ?? null, [reversed]);
  const todayKey = chat.data?.group.today ?? lastDayCard?.dayKey;
  const todayKeyRef = useRef(todayKey);
  todayKeyRef.current = todayKey;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: ChatMessage }[] }) => {
    setCardVisible(viewableItems.some((v) => v.item.kind === "DAY" && v.item.day?.dayKey === todayKeyRef.current));
  }).current;
  const todayIndex = todayKey ? reversed.findIndex((m) => m.kind === "DAY" && m.day?.dayKey === todayKey) : -1;
  function jumpToToday() {
    if (todayIndex >= 0) list.current?.scrollToIndex({ index: todayIndex, viewPosition: 0.3, animated: true });
    else loadOlder();
  }

  async function loadOlder() {
    if (loadingOlder.current || hasMoreOlder === false || !messages.length || !(chat.data?.hasMore || hasMoreOlder)) return;
    loadingOlder.current = true;
    try {
      const page = await fetcher<ChatResponse>(`/api/m/groups/${id}/chat?before=${encodeURIComponent(messages[0].createdAt)}`);
      setOlder((o) => [...page.messages, ...o]);
      setHasMoreOlder(page.hasMore);
    } catch {}
    loadingOlder.current = false;
  }

  async function send(body: string) {
    if (!body || !chat.data) return;
    const tmp: ChatMessage = { id: `tmp-${Date.now()}`, kind: "TEXT", text: body, createdAt: new Date().toISOString(), user: { id: chat.data.me.userId, name: "", imageUrl: null }, day: null, poll: null, pending: true };
    setPending((p) => [...p, tmp]);
    list.current?.scrollToOffset({ offset: 0, animated: true });
    action.mutate(
      { name: "sendMessage", body: { groupId: id, text: body } },
      { onError: () => setPending((p) => p.map((m) => (m.id === tmp.id ? { ...m, pending: false, failed: true } : m))) },
    );
  }

  const meId = chat.data?.me.userId;
  const canDeleteAll = chat.data?.me.role === "ADMIN";
  const refetchRef = useRef(chat.refetch);
  refetchRef.current = chat.refetch;
  const onReported = useCallback(() => {
    refetchRef.current();
  }, []);
  // Liste öğesi çizimi sabit tutulur; yazı yazarken liste baştan çizilmez
  const renderItem = useCallback(
    ({ item: m, index }: { item: ChatMessage; index: number }) => {
      const olderItem = reversed[index + 1];
      if (m.kind === "DAY" && m.day) return <DayCardFull card={m.day} groupId={id} highlight={m.day.dayKey === day} onReported={onReported} />;
      const dayKey = trDay(m.createdAt);
      const sep = !olderItem || olderItem.kind === "DAY" || trDay(olderItem.createdAt) !== dayKey;
      if (m.kind === "BADGE") {
        if (!m.badge) return null;
        return (
          <View>
            {sep && <DaySeparator dayKey={dayKey} />}
            <BadgeCard b={m.badge} />
          </View>
        );
      }
      const mine = m.user?.id === meId;
      const showAuthor = sep || olderItem?.kind === "BADGE" || olderItem?.user?.id !== m.user?.id;
      return (
        <View>
          {sep && <DaySeparator dayKey={dayKey} />}
          <MessageBubble m={m} mine={mine} showAuthor={showAuthor} canDelete={mine || canDeleteAll} />
        </View>
      );
    },
    [reversed, id, day, meId, canDeleteAll, onReported],
  );

  if (chat.isLoading) return <Loading />;
  // Önbellekte sohbet varsa internet yokken de gösterilir
  if (chat.error && !chat.data) {
    if (chat.error.message.includes("üyesi değilsiniz")) return <JoinView groupId={id} />;
    return <ErrorView message={chat.error.message} onRetry={chat.refetch} />;
  }
  const data = chat.data!;
  const isAdmin = data.me.role === "ADMIN";
  const kasa = data.kasa ?? null;
  const todayCard = data.todayCard ?? (lastDayCard?.dayKey === todayKey ? lastDayCard : null);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable onPress={() => router.push(`/group/${id}/info`)}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 16, color: c.foreground }}>
                {data.group.name}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>{data.group.memberCount} üye</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Row gap={16}>
              <Pressable onPress={() => setHistoryOpen(true)} hitSlop={10} accessibilityLabel="Okuma geçmişi">
                <CalendarRange size={22} color={c.foreground} />
              </Pressable>
              <Pressable onPress={() => router.push(`/group/${id}/info`)} hitSlop={10}>
                <Info size={22} color={c.foreground} />
              </Pressable>
              {isAdmin && (
                <Pressable onPress={() => router.push(`/group/${id}/admin`)} hitSlop={10}>
                  <Settings size={22} color={c.foreground} />
                </Pressable>
              )}
            </Row>
          ),
        }}
      />
      {kasa && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Pressable onPress={() => setKasaOpen((o) => !o)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel="Grup kasası">
            <Landmark size={15} color={c.primary} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>
              {kasa.paidTotal != null ? (
                <>
                  Kasa <Text style={{ fontFamily: fonts.bold, color: c.foreground }}>{kasa.paidTotal} TL</Text> · bekleyen <Text style={{ fontFamily: fonts.bold, color: c.foreground }}>{kasa.expected} TL</Text>
                </>
              ) : (
                <>
                  Kasaya girmesi beklenen <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: c.foreground }}>{kasa.expected} TL</Text>
                </>
              )}
            </Text>
            <ChevronDown size={14} color={c.mutedForeground} style={{ transform: [{ rotate: kasaOpen ? "180deg" : "0deg" }] }} />
          </Pressable>
          {kasa.myDebt > 0 && kasa.myDue && <DueBadge due={kasa.myDue} compact />}
          {kasa.myDebt > 0 ? (
            <Pressable onPress={() => setPayOpen(true)} style={({ pressed }) => ({ backgroundColor: c.destructive, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#fff" }}>Borcunu öde · {kasa.myDebt} TL</Text>
            </Pressable>
          ) : (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: c.success }}>Borcun yok</Text>
          )}
        </View>
      )}
      {kasa && kasaOpen && (
        <View style={{ flexDirection: "row", gap: 6, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 10, paddingVertical: 8 }}>
          {[
            { v: kasa.paidTotal ?? 0, l: "Grup kurulduğundan beri kasaya giren", color: c.success },
            { v: kasa.inDue ?? 0, l: `Vade süresince girmesi gereken${kasa.inDueCount ? ` (${kasa.inDueCount} kişi)` : ""}`, color: c.warning, at: kasa.nextDueAt },
            { v: kasa.expected, l: "Ödenmemiş toplam ceza", color: c.destructive },
          ].map((t) => (
            <View key={t.l} style={{ flex: 1, alignItems: "center", backgroundColor: t.color + "1a", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: t.color }}>{t.v} TL</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, lineHeight: 12, textAlign: "center", color: c.mutedForeground }}>{t.l}</Text>
              {t.at ? <Countdown to={t.at} style={{ fontSize: 10 }} /> : null}
            </View>
          ))}
        </View>
      )}
      {todayCard && !cardVisible && <DayShortcut card={todayCard} groupId={id} onJump={jumpToToday} onReported={() => chat.refetch()} />}
      <View style={{ flex: 1, backgroundColor: c.chatBg }}>
        {/* Hafif desenli sohbet duvar kağıdı */}
        <ChatWallpaper />
      <FlatList
        ref={list}
        inverted
        data={reversed}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        onScrollToIndexFailed={(info) => setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.4 }), 400)}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 15 }}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
      />
      </View>
      <Composer canPost={data.me.canPost} onSend={send} onPoll={() => setPollOpen(true)} />
      <PollModal groupId={id} visible={pollOpen} onClose={() => setPollOpen(false)} />
      <GroupHistoryModal groupId={id} visible={historyOpen} onClose={() => setHistoryOpen(false)} />
      {kasa && (
        <PaySheet
          visible={payOpen}
          title="Borcunu öde"
          items={kasa.myDebt > 0 ? [{ group: { id, name: data.group.name, iban: kasa.iban, ibanName: kasa.ibanName }, amount: kasa.myDebt, due: kasa.myDue }] : []}
          onClose={() => setPayOpen(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}
