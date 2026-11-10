import { memo, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react-native";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { toast, useAction } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { ChatMessage } from "@/lib/types";
import { BadgeChip } from "../badge-chip";
import { StreakFlame } from "../day-card";
import { Avatar } from "../ui";
import { ChatPhoto } from "./photo";

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

export const MessageBubble = memo(function MessageBubble({ m, mine, showAuthor, canDelete }: { m: ChatMessage; mine: boolean; showAuthor: boolean; canDelete: boolean }) {
  const c = useColors();
  const action = useAction();
  const [menu, setMenu] = useState(false);
  // Sunucudan yeni veri gelene kadar benim ifadem anında görünür
  const [over, setOver] = useState<{ base: ChatMessage["reactions"]; value: Reaction[] } | null>(null);
  const reactions = over && over.base === m.reactions ? over.value : (m.reactions ?? []);
  const canReact = !m.pending && !m.failed && (m.kind === "TEXT" || m.kind === "POLL" || m.kind === "IMAGE");
  const react = (emoji: string) => {
    setMenu(false);
    setOver({ base: m.reactions, value: toggleReaction(reactions, emoji) });
    action.mutate({ name: "reactMessage", body: { messageId: m.id, emoji } }, { onError: () => setOver(null) });
  };
  const remove = () => {
    setMenu(false);
    Alert.alert("Mesajı sil", mine ? "Mesajın herkes için silinsin mi?" : `${m.user?.name ?? "Bu kişinin"} mesajı herkes için silinsin mi?`, [
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
    <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start", gap: 8, marginTop: showAuthor ? 8 : 2 }}>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {/* Seri: gün kartındaki gibi ismin sağ üst köşesinde hafif eğik alev, içinde gün sayısı */}
            <View style={{ flexShrink: 1, paddingRight: m.user.streak && m.user.streak.n >= 3 ? 9 : 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, color: nameColor(m.user.id) }}>
                {m.user.name}
              </Text>
              <StreakFlame s={m.user.streak} top={-6} right={-4} />
            </View>
            {m.user.badge && <BadgeChip tag={m.user.badge} />}
          </View>
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
          {mine && !m.pending && !m.failed && <Check size={11} color={sub} strokeWidth={2.5} />}
        </View>
      </Pressable>
      {/* İfadeler: baloncuğun altına hafif biner; dokun: ekle/kaldır, uzun bas: kimler */}
      {reactions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: -5, paddingHorizontal: 6, justifyContent: mine ? "flex-end" : "flex-start" }}>
          {reactions.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => canReact && react(r.emoji)}
              onLongPress={() => Alert.alert(`${r.emoji} ${r.count}`, r.names.join("\n"))}
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
            {(!!m.text || canDelete) && <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />}
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
            {canDelete && (
              <Pressable onPress={remove} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? c.muted : "transparent" })}>
                <Trash2 size={17} color={c.destructive} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.destructive }}>Sil</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});
