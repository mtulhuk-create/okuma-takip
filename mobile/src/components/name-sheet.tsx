import { UserRound } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAction } from "@/lib/api";
import { useColors } from "@/lib/theme";
import { Body, Button, H1, Input, Muted, Row } from "./ui";

/** Ad penceresi: ad girilmemişse kapatılamaz; profilden açıldığında düzenleme için kullanılır. */
type Props = { visible: boolean; name: string; required?: boolean; onClose?: () => void };

export function NameSheet(props: Props) {
  const close = () => {
    if (!props.required) props.onClose?.();
  };
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      {/* Her açılışta form kayıtlı adla yeniden başlar */}
      {props.visible && <NameForm {...props} close={close} />}
    </Modal>
  );
}

function NameForm({ name, required, onClose, close }: Props & { close: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const action = useAction();
  const [value, setValue] = useState(name);
  const ok = value.trim().length >= 2;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: "#0007", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: insets.bottom + 20, gap: 14 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.primary + "1a", alignItems: "center", justifyContent: "center" }}>
              <UserRound size={26} color={c.primary} />
            </View>
            <H1 style={{ fontSize: 22 }}>{required ? "Seni tanıyalım" : "Adını düzenle"}</H1>
            <Muted style={{ textAlign: "center" }}>Grup arkadaşların seni sohbette, gün kartlarında ve okuma geçmişinde bu adla görecek.</Muted>
          </View>
          <Input label="Kullanmak istediğiniz adınız" value={value} onChangeText={setValue} autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={60} autoFocus />
          {required && <Body style={{ fontSize: 12, color: c.mutedForeground }}>Devam etmek için adını yaz.</Body>}
          <Row>
            {!required && <Button title="Vazgeç" variant="ghost" onPress={onClose} style={{ flex: 1 }} />}
            <Button
              title="Kaydet"
              style={{ flex: 1 }}
              disabled={!ok}
              loading={action.isPending}
              onPress={() => action.mutate({ name: "saveFullName", body: { name: value } }, { onSuccess: () => onClose?.() })}
            />
          </Row>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
