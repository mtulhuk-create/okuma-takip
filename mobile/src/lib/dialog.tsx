// Uygulama içi dialog (shadcn AlertDialog görünümü): Android'in eski sistem dialoğu yerine.
// Alert.alert ile aynı imza: showAlert(başlık, mesaj?, butonlar?) — React dışından da çağrılabilir.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { fonts, useColors } from "./theme";

export type DialogButton = { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };
type Dialog = { id: number; title: string; message?: string; buttons: DialogButton[] };

let seq = 0;
let queue: Dialog[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const current = () => queue[0] ?? null;

/** Dialog gösterir; ekranda dialog varsa sıraya girer */
export function showAlert(title: string, message?: string, buttons?: DialogButton[]) {
  // Dialog alanı henüz kurulmadıysa (açılışın ilk anı) sistem dialoğu kullanılır
  if (!listeners.size) return Alert.alert(title, message, buttons);
  queue = [...queue, { id: ++seq, title, message, buttons: buttons?.length ? buttons : [{ text: "Tamam" }] }];
  emit();
}

/** Kök düzende bir kez çizilir */
export function DialogHost() {
  const c = useColors();
  const cur = useSyncExternalStore(subscribe, current);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!cur) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [cur, anim]);

  const close = (b?: DialogButton) => {
    queue = queue.slice(1);
    emit();
    // Dialog kapandıktan sonra çalışsın (butonun açtığı yeni dialog ya da ekran üst üste binmesin)
    if (b?.onPress) setTimeout(b.onPress, 0);
  };
  if (!cur) return null;

  const cancel = cur.buttons.find((b) => b.style === "cancel");
  // shadcn düzeni: vazgeç solda (çerçeveli), ana işlem sağda (dolu); 3+ buton alt alta
  const ordered = [...cur.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"));
  const stacked = ordered.length > 2 || ordered.some((b) => b.text.length > 14);
  const main = ordered.filter((b) => b.style !== "cancel").at(-1);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => (cancel || cur.buttons.length === 1 ? close(cancel ?? cur.buttons[0]) : undefined)}>
      <Animated.View style={{ flex: 1, backgroundColor: "#000a", opacity: anim, justifyContent: "center", padding: 24 }}>
        {/* Dışarı dokununca: vazgeç butonu varsa (ya da tek buton) kapanır */}
        <Pressable style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => (cancel || cur.buttons.length === 1 ? close(cancel ?? cur.buttons[0]) : undefined)} />
        <Animated.View
          style={{
            backgroundColor: c.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
            padding: 20,
            gap: 8,
            maxHeight: "80%",
            elevation: 12,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, color: c.foreground }}>{cur.title}</Text>
          {!!cur.message && (
            <ScrollView style={{ flexGrow: 0 }} bounces={false}>
              <Text selectable style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.mutedForeground }}>
                {cur.message}
              </Text>
            </ScrollView>
          )}
          <View style={{ flexDirection: stacked ? "column-reverse" : "row", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            {ordered.map((b, i) => {
              const filled = b.style === "destructive" || b === main;
              const bg = b.style === "destructive" ? c.destructive : filled ? c.primary : "transparent";
              const fg = filled ? (b.style === "destructive" ? "#fff" : c.primaryForeground) : c.foreground;
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => close(b)}
                  style={({ pressed }) => ({
                    minWidth: stacked ? undefined : 84,
                    height: 40,
                    paddingHorizontal: 16,
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: bg,
                    borderWidth: filled ? 0 : 1,
                    borderColor: c.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: fg }}>{b.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
