import { Send, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useColors } from "@/lib/theme";
import type { Rules } from "@/lib/types";
import { TeamPicker } from "./team-picker";
import { Button, Input, Muted, Row } from "./ui";

type Team = { id: string; name: string } & Partial<Pick<Rules, "targetPages" | "minPages" | "penaltyMode" | "penaltyAmount" | "minDiscount">>;

/** Katılma isteği penceresi: ekip seçimi ve yöneticiye not burada (kartta yalnızca buton) */
export function JoinSheet({
  group,
  onClose,
  onSubmit,
  sending,
}: {
  group: { id: string; name: string; teams: Team[] } | null;
  onClose: () => void;
  onSubmit: (teamId: string | undefined, note: string) => void;
  sending: boolean;
}) {
  return (
    <Modal visible={!!group} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {group && <Body group={group} onClose={onClose} onSubmit={onSubmit} sending={sending} />}
    </Modal>
  );
}

function Body({ group, onClose, onSubmit, sending }: { group: { id: string; name: string; teams: Team[] }; onClose: () => void; onSubmit: (teamId: string | undefined, note: string) => void; sending: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [team, setTeam] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const needTeam = group.teams.length > 0;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: insets.bottom + 18, gap: 14 }}>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: c.foreground }}>Gruba katılma isteği</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.foreground }}>{group.name}</Text>
              <Muted>
                İsteğin grubun yöneticisine gider; yönetici onaylayınca gruba katılırsın.
                {needTeam ? " Bu grupta üyeler ekiplere ayrılır: her ekibin kendi günlük hedefi ve cezası vardır." : ""}
              </Muted>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
              <X size={20} color={c.mutedForeground} />
            </Pressable>
          </Row>
          {needTeam && <TeamPicker teams={group.teams} value={team} onChange={setTeam} label="Ekibini seç" />}
          <Input label="Yöneticiye not (isteğe bağlı)" placeholder="Kendini kısaca tanıtabilirsin" value={note} onChangeText={setNote} maxLength={300} multiline />
          <Button title={needTeam && !team ? "Önce ekibini seç" : "İsteği gönder"} icon={Send} disabled={needTeam && !team} loading={sending} onPress={() => onSubmit(team ?? undefined, note)} />
          <Button title="Vazgeç" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
