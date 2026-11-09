import { memo } from "react";
import { Check } from "lucide-react-native";
import { Alert, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { toast, useAction } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { ChatMessage } from "@/lib/types";
import { BadgeChip } from "../badge-chip";
import { StreakChip } from "../history";
import { Avatar } from "../ui";

const NAME_COLORS = ["#be123c", "#b45309", "#047857", "#0369a1", "#6d28d9", "#c2410c", "#0f766e"];
const nameColor = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};

export const MessageBubble = memo(function MessageBubble({ m, mine, showAuthor, canDelete }: { m: ChatMessage; mine: boolean; showAuthor: boolean; canDelete: boolean }) {
  const c = useColors();
  const action = useAction();
  const fg = mine ? c.chatMineFg : c.foreground;
  const sub = mine ? c.chatMineFg + "99" : c.mutedForeground;
  const bg = mine ? c.chatMine : c.card;
  const poll = m.poll;
  const max = poll ? Math.max(1, ...poll.options.map((o) => o.votes)) : 1;

  return (
    <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start", gap: 8, marginTop: showAuthor ? 8 : 2 }}>
      {!mine && <View style={{ width: 30 }}>{showAuthor && m.user && <Avatar name={m.user.name} uri={m.user.imageUrl} initial={m.user.initial} seed={m.user.id} size={30} />}</View>}
      <Pressable
        // Uzun bas: kopyala; kendi mesajını ya da (yöneticiysen) herkesin mesajını sil
        onLongPress={() => {
          if (m.pending) return;
          const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
          if (m.text) buttons.push({ text: "Kopyala", onPress: () => Clipboard.setStringAsync(m.text ?? "").then(() => toast("Kopyalandı")) });
          if (canDelete)
            buttons.push({
              text: "Sil",
              style: "destructive",
              onPress: () =>
                Alert.alert("Mesajı sil", mine ? "Mesajın herkes için silinsin mi?" : `${m.user?.name ?? "Bu kişinin"} mesajı herkes için silinsin mi?`, [
                  { text: "Vazgeç", style: "cancel" },
                  { text: "Sil", style: "destructive", onPress: () => action.mutate({ name: "deleteMessage", body: { messageId: m.id } }) },
                ]),
            });
          if (!buttons.length) return;
          buttons.push({ text: "Vazgeç", style: "cancel" });
          Alert.alert(m.poll ? "Anket" : "Mesaj", undefined, buttons);
        }}
        style={{
          maxWidth: "80%",
          minWidth: poll ? "70%" : undefined,
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
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 12, color: nameColor(m.user.id) }}>
              {m.user.name}
            </Text>
            {m.user.badge && <BadgeChip tag={m.user.badge} />}
            <StreakChip s={m.user.streak} />
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
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: fg }}>{m.text}</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-end", marginTop: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: sub }}>{m.failed ? "Gönderilemedi" : m.pending ? "Gönderiliyor…" : formatClock(m.createdAt)}</Text>
          {mine && !m.pending && !m.failed && <Check size={11} color={sub} strokeWidth={2.5} />}
        </View>
      </Pressable>
    </View>
  );
});
