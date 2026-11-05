import { BarChart3, Plus, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useAction } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import { Button, Input, Row } from "../ui";

export function PollModal({ groupId, visible, onClose }: { groupId: string; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const action = useAction();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const reset = () => {
    setQuestion("");
    setOptions(["", ""]);
    setMultiple(false);
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0006" }}>
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: "85%" }}>
          <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <Row>
              <BarChart3 size={20} color={c.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: c.foreground }}>Anket oluştur</Text>
            </Row>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={c.mutedForeground} />
            </Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            <Input label="Soru" value={question} onChangeText={setQuestion} placeholder="Örn. Bu ay hangi kitabı okuyalım?" maxLength={300} />
            {options.map((o, i) => (
              <Row key={i}>
                <Input value={o} onChangeText={(t) => setOptions((all) => all.map((x, j) => (j === i ? t : x)))} placeholder={`Seçenek ${i + 1}`} maxLength={100} />
                {options.length > 2 && (
                  <Pressable onPress={() => setOptions((all) => all.filter((_, j) => j !== i))} hitSlop={8}>
                    <Trash2 size={18} color={c.mutedForeground} />
                  </Pressable>
                )}
              </Row>
            ))}
            {options.length < 10 && <Button title="Seçenek ekle" icon={Plus} small variant="ghost" style={{ alignSelf: "flex-start" }} onPress={() => setOptions((all) => [...all, ""])} />}
            <Row style={{ justifyContent: "space-between", borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12 }}>
              <Text style={{ fontFamily: fonts.medium, color: c.foreground }}>Birden fazla seçime izin ver</Text>
              <Switch value={multiple} onValueChange={setMultiple} trackColor={{ true: c.primary, false: c.muted }} thumbColor="#fff" />
            </Row>
            <Button
              title="Anketi gönder"
              loading={action.isPending}
              onPress={() =>
                action.mutate(
                  { name: "createPoll", body: { groupId, question, options: JSON.stringify(options), multiple: multiple ? "1" : "0" } },
                  {
                    onSuccess: () => {
                      reset();
                      onClose();
                    },
                  },
                )
              }
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
