import { Check, Plus, Tag, X } from "lucide-react-native";
import { memo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAction } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import { LITE } from "@/lib/variant";
import type { BadgeView } from "@/lib/types";
import { BadgeChip } from "../badge-chip";
import { Countdown } from "../countdown";
import { showAlert } from "@/lib/dialog";

const ORANGE = "#f97316";

/** Sohbetteki rozet kartı: oylama, kazanıldı ya da kalktı */
export const BadgeCard = memo(function BadgeCard({ b }: { b: BadgeView }) {
  return b.event === "VOTE" ? <VoteCard b={b} /> : <AnnounceCard b={b} />;
});

function confirmThen(title: string, onOk: () => void) {
  showAlert(title, undefined, [
    { text: "Vazgeç", style: "cancel" },
    { text: "Evet", style: "destructive", onPress: onOk },
  ]);
}

function AnnounceCard({ b }: { b: BadgeView }) {
  const c = useColors();
  const action = useAction();
  const good = b.kind === "GOOD";
  const text =
    b.event === "AWARD"
      ? good
        ? `🌟 ${b.user.name} 7 gün üst üste tam okudu`
        : `${b.user.name} rozetini aldı`
      : good
        ? `${b.user.name} 2 gün tam okumadı, rozeti kalktı`
        : `🎉 ${b.user.name} 2 gün tam okudu, rozeti kalktı`;
  return (
    <View style={{ alignSelf: "center", maxWidth: "88%", alignItems: "center", gap: 6, marginVertical: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: good ? "#10b98122" : "#f9731622" }}>
      <Text style={{ textAlign: "center", fontFamily: fonts.medium, fontSize: 13, color: c.foreground }}>{text}</Text>
      {b.label && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <BadgeChip tag={{ kind: b.kind, label: b.label }} big struck={b.event === "END"} />
          {b.event === "AWARD" && b.status !== "ACTIVE" && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>(kalktı)</Text>}
        </View>
      )}
      {b.event === "AWARD" && b.status === "ACTIVE" && (
        <Text style={{ textAlign: "center", fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>
          {good ? "Sonraki günlerde 2 gün tam okunmazsa kalkar." : "Sonraki günlerde 2 gün tam okursa kalkar."}
        </Text>
      )}
      {b.event === "AWARD" && b.canRemove && !LITE && (
        <Pressable hitSlop={6} onPress={() => confirmThen("Bu rozet kaldırılsın mı?", () => action.mutate({ name: "removeBadge", body: { badgeId: b.id } }))}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.mutedForeground }}>Rozeti kaldır</Text>
        </Pressable>
      )}
    </View>
  );
}

function VoteCard({ b }: { b: BadgeView }) {
  const c = useColors();
  const action = useAction();
  const [label, setLabel] = useState("");
  const max = Math.max(1, ...b.options.map((o) => o.votes));
  const total = b.options.reduce((n, o) => n + o.votes, 0);
  const words = label.trim().split(/\s+/).filter(Boolean).length;
  const canSend = !!label.trim() && words <= 2 && !action.isPending;
  return (
    <View style={{ marginVertical: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: ORANGE + "88", backgroundColor: c.card, overflow: "hidden", elevation: 1 }}>
      <View style={{ flexDirection: "row", gap: 10, padding: 12, backgroundColor: ORANGE + "18" }}>
        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" }}>
          <Tag size={19} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>Rozet oylaması · {b.user.name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>
            {b.isMe ? "7 gündür tam okuyamadın; grup arkadaşların sana latife bir rozet seçiyor." : "7 gündür tam okuyamadı. Ona latife bir rozet önerin ve oylayın (en fazla 2 kelime)."}
          </Text>
        </View>
      </View>

      <View style={{ padding: 12, gap: 8 }}>
        {b.voting && b.voteUntil ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Oylama bitimine</Text>
            <Countdown to={b.voteUntil} style={{ fontSize: 11 }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>· {total} oy · eşitlikte rastgele</Text>
          </View>
        ) : b.status === "CANCELLED" ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: c.mutedForeground }}>Rozet verilmedi (şık önerilmedi ya da oylama iptal edildi).</Text>
        ) : b.label ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.foreground }}>Sonuç:</Text>
            <BadgeChip tag={{ kind: b.kind, label: b.label }} big />
            {b.status === "ENDED" && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>(kalktı)</Text>}
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: c.mutedForeground }}>Oylama sonuçlanıyor…</Text>
        )}

        {b.voting && b.options.length === 0 && <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: c.mutedForeground }}>Henüz şık önerilmedi.</Text>}
        {b.options.map((o) => (
          <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable
              disabled={!b.canVote || action.isPending}
              onPress={() => action.mutate({ name: "voteBadge", body: { badgeId: b.id, optionId: o.id } })}
              style={{ flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: o.mine ? ORANGE : c.border, overflow: "hidden", justifyContent: "center" }}
            >
              <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(o.votes / max) * 100}%`, backgroundColor: ORANGE + "26" }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: ORANGE, backgroundColor: o.mine ? ORANGE : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {o.mine && <Check size={11} color="#fff" strokeWidth={3} />}
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>{o.label}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.mutedForeground }}>{o.votes}</Text>
              </View>
            </Pressable>
            {o.canDelete && (
              <Pressable hitSlop={8} accessibilityLabel="Şıkkı kaldır" onPress={() => confirmThen(`"${o.label}" şıkkı kaldırılsın mı?`, () => action.mutate({ name: "deleteBadgeOption", body: { optionId: o.id } }))}>
                <X size={18} color={c.mutedForeground} />
              </Pressable>
            )}
          </View>
        ))}

        {b.canVote && !b.proposed && (
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TextInput
              value={label}
              onChangeText={setLabel}
              maxLength={24}
              placeholder="Rozet öner (en fazla 2 kelime)"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="words"
              style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, fontFamily: fonts.regular, fontSize: 14, color: c.foreground, backgroundColor: c.background }}
            />
            <Pressable
              disabled={!canSend}
              onPress={() => action.mutate({ name: "proposeBadge", body: { badgeId: b.id, label } }, { onSuccess: () => setLabel("") })}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 40, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.primary, opacity: canSend ? 1 : 0.5 }}
            >
              <Plus size={16} color={c.primaryForeground} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.primaryForeground }}>Öner</Text>
            </Pressable>
          </View>
        )}
        {b.canVote && b.proposed && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Şıkkını önerdin; istediğin şıkka oy verebilirsin.</Text>}
        {b.canRemove && !LITE && (
          <Pressable
            hitSlop={6}
            onPress={() => confirmThen(b.status === "VOTING" ? "Oylama iptal edilsin mi?" : "Rozet kaldırılsın mı?", () => action.mutate({ name: "removeBadge", body: { badgeId: b.id } }))}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.mutedForeground }}>{b.status === "VOTING" ? "Oylamayı iptal et" : "Rozeti kaldır"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
