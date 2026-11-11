import { memo, useMemo, useState } from "react";
import { Check, CheckCheck, Copy, Info, Reply, Trash2 } from "lucide-react-native";
import { Animated, Modal, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { toast, useAction } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { ChatMessage } from "@/lib/types";
import { BadgeChip } from "../badge-chip";
import { StreakFlame } from "../day-card";
import { Avatar } from "../ui";
import { ChatPhoto } from "./photo";
import { showAlert } from "@/lib/dialog";

const NAME_COLORS = ["#be123c", "#b45309", "#047857", "#0369a1", "#6d28d9", "#c2410c", "#0f766e"];
const nameColor = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};

/** Mesajlara bırakılabilen ifadeler (sunucudakiyle aynı) */
const REACTIONS = ["👍", "❤️", "🤲", "😂", "😮", "🔥"];
type Reaction = NonNullable<ChatMessage["reactions"]>[number];

/** Benim ifademi değiştirir: aynısıysa kaldırır, farklıysa yerine koyar (anında görünsün diye) */
function toggleReaction(list: Reaction[], emoji: string): Reaction[] {
  const had = list.find((r) => r.mine)?.emoji;
  let out = list.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false, names: r.names.filter((n) => n !== "Sen") } : r)).filter((r) => r.count > 0);
  if (had !== emoji) {
    const hit = out.find((r) => r.emoji === emoji);
    out = hit ? out.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true, names: [...r.names, "Sen"] } : r)) : [...out, { emoji, count: 1, mine: true, names: ["Sen"] }];
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Yanıt önizlemesi için mesajın kısa metni */
export function replySnippet(m: Pick<ChatMessage, "kind" | "text" | "poll">) {
  if (m.kind === "IMAGE") return `📷 ${m.text ?? "Fotoğraf"}`;
  if (m.kind === "POLL") return `📊 ${m.poll?.question ?? "Anket"}`;
  return m.text ?? "";
}

/** Okundu bilgisi: her üyenin sohbeti en son okuduğu an */
export type Reads = { id: string; name: string; at: string | null }[];

/** Mesajı kimler okudu / okumadı (yazan hariç): üye sohbeti mesajdan sonra okuduysa okumuştur */
function readState(m: Pick<ChatMessage, "createdAt" | "user">, reads: Reads) {
  const others = reads.filter((r) => r.id !== m.user?.id);
  const read = others.filter((r) => r.at && r.at >= m.createdAt);
  return { read, unread: others.filter((r) => !read.includes(r)), all: others.length > 0 && read.length === others.length };
}

/** Sağa kaydırma bu kadar olunca (dp) bırakıldığında yanıt başlar */
const SWIPE_REPLY = 46;

export const MessageBubble = memo(function MessageBubble({
  m,
  mine,
  showAuthor,
  canDelete,
  onReply,
  onQuote,
  reads,
}: {
  m: ChatMessage;
  mine: boolean;
  showAuthor: boolean;
  canDelete: boolean;
  /** Mesajı yanıtla: sağa kaydırınca ya da menüden (yazma izni yoksa verilmez) */
  onReply?: (m: ChatMessage) => void;
  /** Yanıtlanan mesaja git */
  onQuote?: (id: string) => void;
  /** Okundu bilgisi (yalnızca kendi mesajlarımda: tikler ve "kim okudu") */
  reads?: Reads | null;
}) {
  const c = useColors();
  const [info, setInfo] = useState(false);
  const seen = mine && reads && !m.pending && !m.failed ? readState(m, reads) : null;
  const action = useAction();
  const [menu, setMenu] = useState(false);
  // Sunucudan yeni veri gelene kadar benim ifadem anında görünür
  const [over, setOver] = useState<{ base: ChatMessage["reactions"]; value: Reaction[] } | null>(null);
  const reactions = over && over.base === m.reactions ? over.value : (m.reactions ?? []);
  const canReact = !m.pending && !m.failed && (m.kind === "TEXT" || m.kind === "POLL" || m.kind === "IMAGE");
  const canReply = canReact && !!onReply;
  // Sağa kaydır: balon parmakla birlikte kayar, yeterince çekilip bırakılınca yanıt başlar (WhatsApp gibi)
  const [dx] = useState(() => new Animated.Value(0));
  const pan = useMemo(() => {
    const back = () => Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    return PanResponder.create({
      // Yalnızca belirgin yatay harekette devralır; dikey kaydırma listeye kalır
      onMoveShouldSetPanResponder: (_, g) => canReply && g.dx > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => dx.setValue(Math.max(0, Math.min(70, g.dx * 0.6))),
      onPanResponderRelease: (_, g) => {
        if (g.dx * 0.6 >= SWIPE_REPLY) onReply?.(m);
        back();
      },
      onPanResponderTerminate: back,
    });
  }, [canReply, dx, m, onReply]);
  const react = (emoji: string) => {
    setMenu(false);
    setOver({ base: m.reactions, value: toggleReaction(reactions, emoji) });
    action.mutate({ name: "reactMessage", body: { messageId: m.id, emoji } }, { onError: () => setOver(null) });
  };
  const remove = () => {
    setMenu(false);
    showAlert("Mesajı sil", mine ? "Mesajın herkes için silinsin mi?" : `${m.user?.name ?? "Bu kişinin"} mesajı herkes için silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => action.mutate({ name: "deleteMessage", body: { messageId: m.id } }) },
    ]);
  };
  const fg = mine ? c.chatMineFg : c.foreground;
  const sub = mine ? c.chatMineFg + "99" : c.mutedForeground;
  const bg = mine ? c.chatMine : c.card;
  const poll = m.poll;
  const max = poll ? Math.max(1, ...poll.options.map((o) => o.votes)) : 1;

  return (
    <Animated.View {...pan.panHandlers} style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start", gap: 8, marginTop: showAuthor ? 8 : 2, transform: [{ translateX: dx }] }}>
      {/* Kaydırırken soldan beliren yanıt simgesi */}
      {canReply && (
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: -34, top: 0, bottom: 0, justifyContent: "center", opacity: dx.interpolate({ inputRange: [0, SWIPE_REPLY], outputRange: [0, 1], extrapolate: "clamp" }) }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: "center", justifyContent: "center", elevation: 2 }}>
            <Reply size={15} color={c.primary} />
          </View>
        </Animated.View>
      )}
      {!mine && <View style={{ width: 30 }}>{showAuthor && m.user && <Avatar name={m.user.name} uri={m.user.imageUrl} initial={m.user.initial} seed={m.user.id} size={30} frame={m.user.tier} />}</View>}
      <View style={{ maxWidth: "80%", alignItems: mine ? "flex-end" : "flex-start" }}>
      <Pressable
        // Uzun bas: ifade bırak, kopyala; kendi mesajını ya da (yöneticiysen) herkesin mesajını sil
        onLongPress={() => {
          if (m.pending) return;
          if (canReact || m.text || canDelete) setMenu(true);
        }}
        style={{
          maxWidth: "100%",
          minWidth: poll ? "85%" : undefined,
          backgroundColor: bg,
          borderRadius: 12,
          borderTopLeftRadius: !mine && showAuthor ? 0 : 12,
          borderTopRightRadius: mine && showAuthor ? 0 : 12,
          paddingHorizontal: 10,
          paddingTop: 6,
          paddingBottom: 4,
          opacity: m.pending ? 0.7 : 1,
          elevation: 1,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        {/* Grubun ilk mesajında balon kuyruğu */}
        {showAuthor && (
          <View
            style={{
              position: "absolute",
              top: 0,
              [mine ? "right" : "left"]: -8,
              width: 0,
              height: 0,
              borderTopWidth: 12,
              borderTopColor: bg,
              [mine ? "borderRightWidth" : "borderLeftWidth"]: 9,
              [mine ? "borderRightColor" : "borderLeftColor"]: "transparent",
            }}
          />
        )}
        {!mine && showAuthor && m.user && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, includeFontPadding: false, color: nameColor(m.user.id) }}>
              {m.user.name}
            </Text>
            {/* Seri: ismin hemen sağında, aynı hizada dik alev; içinde gün sayısı */}
            <StreakFlame s={m.user.streak} inline />
            {m.user.badge && <BadgeChip tag={m.user.badge} />}
          </View>
        )}
        {m.reply && (
          // Yanıtlanan mesaj: dokununca o mesaja gider
          <Pressable
            onPress={() => onQuote?.(m.reply!.id)}
            style={{ minWidth: 130, marginBottom: 4, marginTop: 1, borderLeftWidth: 3, borderLeftColor: c.primary, borderRadius: 6, backgroundColor: mine ? "#0000001f" : c.muted, paddingHorizontal: 7, paddingVertical: 4 }}
          >
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: mine ? c.chatMineFg : c.primary }}>
              {m.reply.name || "Mesaj"}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: sub }}>
              {m.reply.text}
            </Text>
          </Pressable>
        )}
        {poll ? (
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: fg }}>{poll.question}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: sub }}>{poll.multiple ? "Birden fazla seçebilirsin" : "Bir seçenek seç"}</Text>
            {poll.options.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => action.mutate({ name: "votePoll", body: { optionId: o.id } })}
                style={{ borderWidth: 1, borderColor: mine ? c.chatMineFg + "33" : c.border, borderRadius: 10, overflow: "hidden" }}
              >
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(o.votes / max) * 100}%`, backgroundColor: c.primary + "22" }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: c.primary, backgroundColor: o.mine ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {o.mine && <Check size={11} color={c.primaryForeground} strokeWidth={3} />}
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: fg }}>{o.text}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: fg }}>{o.votes}</Text>
                </View>
              </Pressable>
            ))}
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: sub }}>{poll.voters} kişi oy verdi</Text>
          </View>
        ) : m.kind === "IMAGE" && m.image ? (
          <ChatPhoto m={m} color={fg} />
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: fg }}>{m.text}</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-end", marginTop: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: sub }}>{m.failed ? "Gönderilemedi" : m.pending ? (m.kind === "IMAGE" ? "Yükleniyor…" : "Gönderiliyor…") : formatClock(m.createdAt)}</Text>
          {/* Tikler: tek = gönderildi, çift = okuyan var, mavi çift = herkes okudu; dokununca kim okudu */}
          {mine && !m.pending && !m.failed && (
            <Pressable onPress={() => seen && setInfo(true)} hitSlop={10} accessibilityLabel="Mesaj bilgisi">
              {seen && seen.read.length > 0 ? <CheckCheck size={14} color={seen.all ? "#38bdf8" : sub} strokeWidth={2.5} /> : <Check size={11} color={sub} strokeWidth={2.5} />}
            </Pressable>
          )}
        </View>
      </Pressable>
      {/* İfadeler: baloncuğun altına hafif biner; dokun: ekle/kaldır, uzun bas: kimler */}
      {reactions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: -5, paddingHorizontal: 6, justifyContent: mine ? "flex-end" : "flex-start" }}>
          {reactions.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => canReact && react(r.emoji)}
              onLongPress={() => showAlert(`${r.emoji} ${r.count}`, r.names.join("\n"))}
              hitSlop={4}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 99,
                backgroundColor: r.mine ? c.primary + "26" : c.card,
                borderWidth: 1,
                borderColor: r.mine ? c.primary + "88" : c.border,
                opacity: pressed ? 0.7 : 1,
                elevation: 1,
              })}
            >
              <Text style={{ fontSize: 12, lineHeight: 16 }}>{r.emoji}</Text>
              {r.count > 1 && <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: c.mutedForeground }}>{r.count}</Text>}
            </Pressable>
          ))}
        </View>
      )}
      </View>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)} statusBarTranslucent>
        <Pressable onPress={() => setMenu(false)} style={{ flex: 1, backgroundColor: "#0006", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: 18, paddingVertical: 8, minWidth: 260, elevation: 8 }}>
            {canReact && (
              <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 8, paddingVertical: 4 }}>
                {REACTIONS.map((e) => {
                  const on = reactions.some((r) => r.mine && r.emoji === e);
                  return (
                    <Pressable
                      key={e}
                      onPress={() => react(e)}
                      accessibilityLabel={`${e} ifadesini bırak`}
                      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.primary + "26" : pressed ? c.muted : "transparent", transform: [{ scale: pressed ? 1.15 : 1 }] })}
                    >
                      <Text style={{ fontSize: 24, lineHeight: 30 }}>{e}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {(canReply || !!m.text || canDelete || !!seen) && <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />}
            {canReply && (
              <Pressable
                onPress={() => {
                  setMenu(false);
                  onReply?.(m);
                }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? c.muted : "transparent" })}
              >
                <Reply size={17} color={c.foreground} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.foreground }}>Yanıtla</Text>
              </Pressable>
            )}
            {!!m.text && (
              <Pressable
                onPress={() => {
                  setMenu(false);
                  Clipboard.setStringAsync(m.text ?? "").then(() => toast("Kopyalandı"));
                }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? c.muted : "transparent" })}
              >
                <Copy size={17} color={c.foreground} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.foreground }}>Kopyala</Text>
              </Pressable>
            )}
            {seen && (
              <Pressable
                onPress={() => {
                  setMenu(false);
                  setInfo(true);
                }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? c.muted : "transparent" })}
              >
                <Info size={17} color={c.foreground} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.foreground }}>Mesaj bilgisi</Text>
              </Pressable>
            )}
            {canDelete && (
              <Pressable onPress={remove} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? c.muted : "transparent" })}>
                <Trash2 size={17} color={c.destructive} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.destructive }}>Sil</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {/* Mesaj bilgisi: kimler okudu, kimler okumadı */}
      {seen && (
        <Modal visible={info} transparent animationType="fade" onRequestClose={() => setInfo(false)} statusBarTranslucent>
          <Pressable onPress={() => setInfo(false)} style={{ flex: 1, backgroundColor: "#000a", justifyContent: "center", padding: 28 }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 18, gap: 12, maxHeight: "75%", elevation: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: c.foreground }}>Mesaj bilgisi</Text>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12 }}>
                {[
                  { title: "Okuyanlar", list: seen.read, Icon: CheckCheck, color: "#38bdf8" },
                  { title: "Okumayanlar", list: seen.unread, Icon: Check, color: c.mutedForeground },
                ].map(({ title, list, Icon, color }) => (
                  <View key={title} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Icon size={14} color={color} strokeWidth={2.5} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color }}>
                        {title} · {list.length}
                      </Text>
                    </View>
                    {list.length ? (
                      list.map((r) => (
                        <Text key={r.id} numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 14, color: c.foreground }}>
                          {r.name}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>Kimse yok</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
              <Pressable onPress={() => setInfo(false)} style={({ pressed }) => ({ height: 40, borderRadius: 9, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Kapat</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Animated.View>
  );
});
