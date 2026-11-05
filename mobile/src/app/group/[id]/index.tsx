import { useQuery } from "@tanstack/react-query";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { BarChart3, Info, Lock, Receipt, SendHorizontal, Settings } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageBubble } from "@/components/chat/message";
import { PollModal } from "@/components/chat/poll-modal";
import { DayCardFull } from "@/components/day-card";
import { JoinView } from "@/components/join-view";
import { ErrorView, Loading, Row } from "@/components/ui";
import { ApiError, useAction, useApi, useApiFetch } from "@/lib/api";
import { formatDayLong } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { ChatMessage, ChatResponse, MeResponse } from "@/lib/types";

const trDay = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
function dayLabel(day: string) {
  if (day === trDay(new Date().toISOString())) return "Bugün";
  if (day === trDay(new Date(Date.now() - 86_400_000).toISOString())) return "Dün";
  return formatDayLong(day);
}

export default function ChatScreen() {
  const { id, day } = useLocalSearchParams<{ id: string; day?: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const fetcher = useApiFetch();
  const action = useAction();
  const chat = useQuery({ queryKey: [`/api/m/groups/${id}/chat`], queryFn: () => fetcher<ChatResponse>(`/api/m/groups/${id}/chat`), retry: (n, e) => !(e instanceof ApiError) && n < 2 });
  const me = useApi<MeResponse>("/api/m/me");
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [pollOpen, setPollOpen] = useState(false);
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
          if (res.events.length) chat.refetch();
        } catch {}
      };
      const t = setInterval(tick, 2000);
      return () => {
        active = false;
        clearInterval(t);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, fetcher]),
  );

  const latest = chat.data?.messages ?? [];
  const messages = useMemo(() => {
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

  async function send() {
    const body = text.trim();
    if (!body || !chat.data) return;
    setText("");
    const tmp: ChatMessage = { id: `tmp-${Date.now()}`, kind: "TEXT", text: body, createdAt: new Date().toISOString(), user: { id: chat.data.me.userId, name: "", imageUrl: null }, day: null, poll: null, pending: true };
    setPending((p) => [...p, tmp]);
    list.current?.scrollToOffset({ offset: 0, animated: true });
    action.mutate(
      { name: "sendMessage", body: { groupId: id, text: body } },
      { onError: () => setPending((p) => p.map((m) => (m.id === tmp.id ? { ...m, pending: false, failed: true } : m))) },
    );
  }

  if (chat.isLoading) return <Loading />;
  if (chat.error) {
    if (chat.error.message.includes("üyesi değilsiniz")) return <JoinView groupId={id} />;
    return <ErrorView message={chat.error.message} onRetry={chat.refetch} />;
  }
  const data = chat.data!;
  const isAdmin = data.me.role === "ADMIN";
  const due = me.data?.money.dues.find((d) => d.groupId === id && d.status === "PENDING");

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
      {due && (
        <Pressable onPress={() => router.push(`/group/${id}/info`)} style={{ backgroundColor: c.dangerBg, paddingVertical: 7, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
          <Receipt size={14} color={c.destructive} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.destructive }}>{due.amount} TL ceza ödemen var · ödeme bilgileri</Text>
        </Pressable>
      )}
      <FlatList
        ref={list}
        inverted
        data={reversed}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        onScrollToIndexFailed={(info) => setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.4 }), 400)}
        renderItem={({ item: m, index }) => {
          const olderItem = reversed[index + 1];
          if (m.kind === "DAY" && m.day) return <DayCardFull card={m.day} groupId={id} highlight={m.day.dayKey === day} onReported={() => chat.refetch()} />;
          const dayKey = trDay(m.createdAt);
          const sep = !olderItem || olderItem.kind === "DAY" || trDay(olderItem.createdAt) !== dayKey;
          const mine = m.user?.id === data.me.userId;
          const showAuthor = sep || olderItem?.user?.id !== m.user?.id;
          return (
            <View>
              {sep && (
                <View style={{ alignSelf: "center", backgroundColor: c.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginVertical: 10 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: c.mutedForeground }}>{dayLabel(dayKey)}</Text>
                </View>
              )}
              <MessageBubble m={m} mine={mine} showAuthor={showAuthor} canDelete={mine || isAdmin} />
            </View>
          );
        }}
      />
      <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card, paddingHorizontal: 8, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom) }}>
        {data.me.canPost ? (
          <Row gap={6} style={{ alignItems: "flex-end" }}>
            <Pressable onPress={() => setPollOpen(true)} hitSlop={6} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={22} color={c.mutedForeground} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Mesaj yaz"
              placeholderTextColor={c.mutedForeground}
              multiline
              maxLength={2000}
              style={{ flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontFamily: fonts.regular, fontSize: 15, color: c.foreground }}
            />
            <Pressable onPress={send} disabled={!text.trim()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.primary, opacity: text.trim() ? 1 : 0.5, alignItems: "center", justifyContent: "center" }}>
              <SendHorizontal size={19} color={c.primaryForeground} />
            </Pressable>
          </Row>
        ) : (
          <Row style={{ justifyContent: "center", paddingVertical: 8 }} gap={6}>
            <Lock size={15} color={c.mutedForeground} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: c.mutedForeground }}>Bu grupta yalnızca yöneticiler mesaj gönderebilir</Text>
          </Row>
        )}
      </View>
      <PollModal groupId={id} visible={pollOpen} onClose={() => setPollOpen(false)} />
    </KeyboardAvoidingView>
  );
}
