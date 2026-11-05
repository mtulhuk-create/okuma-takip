import { Check } from "lucide-react-native";
import { Alert, Pressable, Text, View } from "react-native";
import { useAction } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { ChatMessage } from "@/lib/types";
import { Avatar } from "../ui";

const NAME_COLORS = ["#be123c", "#b45309", "#047857", "#0369a1", "#6d28d9", "#c2410c", "#0f766e"];
const nameColor = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};

export function MessageBubble({ m, mine, showAuthor, canDelete }: { m: ChatMessage; mine: boolean; showAuthor: boolean; canDelete: boolean }) {
  const c = useColors();
  const action = useAction();
  const fg = mine ? c.primaryForeground : c.foreground;
  const sub = mine ? c.primaryForeground + "b3" : c.mutedForeground;
  const poll = m.poll;
  const max = poll ? Math.max(1, ...poll.options.map((o) => o.votes)) : 1;

  return (
    <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, marginTop: showAuthor ? 10 : 2 }}>
      {!mine && <View style={{ width: 30 }}>{showAuthor && m.user && <Avatar name={m.user.name} uri={m.user.imageUrl} size={30} />}</View>}
      <Pressable
        onLongPress={() =>
          canDelete &&
          !m.pending &&
          Alert.alert("Mesajı sil", "Bu mesaj herkes için silinsin mi?", [
            { text: "Vazgeç", style: "cancel" },
            { text: "Sil", style: "destructive", onPress: () => action.mutate({ name: "deleteMessage", body: { messageId: m.id } }) },
          ])
        }
        style={{
          maxWidth: "80%",
          minWidth: poll ? "70%" : undefined,
          backgroundColor: mine ? c.primary : c.card,
          borderWidth: mine ? 0 : 1,
          borderColor: c.border,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          opacity: m.pending ? 0.7 : 1,
        }}
      >
        {!mine && showAuthor && m.user && <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: nameColor(m.user.id), marginBottom: 2 }}>{m.user.name}</Text>}
        {poll ? (
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: fg }}>{poll.question}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: sub }}>{poll.multiple ? "Birden fazla seçebilirsin" : "Bir seçenek seç"}</Text>
            {poll.options.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => action.mutate({ name: "votePoll", body: { optionId: o.id } })}
                style={{ borderWidth: 1, borderColor: mine ? c.primaryForeground + "55" : c.border, borderRadius: 10, overflow: "hidden" }}
              >
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(o.votes / max) * 100}%`, backgroundColor: mine ? c.primaryForeground + "33" : c.primary + "1a" }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: mine ? c.primaryForeground : c.primary, backgroundColor: o.mine ? (mine ? c.primaryForeground : c.primary) : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {o.mine && <Check size={11} color={mine ? c.primary : c.primaryForeground} strokeWidth={3} />}
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
        <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: sub, alignSelf: "flex-end", marginTop: 2 }}>{m.failed ? "Gönderilemedi" : m.pending ? "Gönderiliyor…" : formatClock(m.createdAt)}</Text>
      </Pressable>
    </View>
  );
}
