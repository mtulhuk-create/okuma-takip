import { Image } from "expo-image";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { fonts, useColors } from "@/lib/theme";
import { appIconAvailable, getAppIcon, setAppIcon, type AppIcon } from "../../modules/day-card-notification";
import { Muted, Row } from "./ui";
import { showAlert } from "@/lib/dialog";

const OPTIONS: { key: AppIcon; label: string; src: number }[] = [
  { key: "light", label: "Açık", src: require("@/assets/images/app-icon-light.png") },
  { key: "dark", label: "Koyu", src: require("@/assets/images/app-icon-dark.png") },
];

/** Ana ekrandaki uygulama simgesi: açık ya da koyu amblem (Android) */
export function AppIconPicker() {
  const c = useColors();
  const [current, setCurrent] = useState<AppIcon>(() => (appIconAvailable ? getAppIcon() : "light"));
  if (!appIconAvailable) return null;
  const choose = (key: AppIcon) => {
    if (key === current) return;
    showAlert("Uygulama simgesi değişsin mi?", "Ana ekrandaki simge birkaç saniye içinde değişir. Bazı telefonlarda uygulama bu sırada kapanabilir; yeniden açman yeterli.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Değiştir",
        onPress: () => {
          setAppIcon(key);
          setCurrent(key);
        },
      },
    ]);
  };
  return (
    <View style={{ gap: 8 }}>
      <Muted>Uygulama simgesi</Muted>
      <Row gap={12}>
        {OPTIONS.map((o) => {
          const on = current === o.key;
          return (
            <Pressable key={o.key} onPress={() => choose(o.key)} accessibilityLabel={`${o.label} simge`} style={({ pressed }) => ({ alignItems: "center", gap: 4, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ borderRadius: 18, borderWidth: 2, borderColor: on ? c.primary : "transparent", padding: 2 }}>
                <Image source={o.src} style={{ width: 56, height: 56, borderRadius: 14 }} />
                {on && (
                  <View style={{ position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.card }}>
                    <Check size={11} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: on ? fonts.semibold : fonts.regular, fontSize: 12, color: on ? c.primary : c.mutedForeground }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}
