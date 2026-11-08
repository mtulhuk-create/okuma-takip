import { router } from "expo-router";
import { Smartphone } from "lucide-react-native";
import { Text, View } from "react-native";
import { fonts, useColors } from "@/lib/theme";
import { Button } from "./ui";

/** Lite sürümde bulunmayan (yönetici) ekranlar yerine */
export function LiteBlocked() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: c.background }}>
      <Smartphone size={36} color={c.mutedForeground} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: c.foreground, textAlign: "center" }}>Lite sürümde yok</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: c.mutedForeground, textAlign: "center" }}>
        Okuma Takip Lite eski telefonlar için hafifletilmiş sürümdür; grup kurma ve yönetim özellikleri bulunmaz. Bunlar için web sitesini (okumatakipp.site) ya da tam sürümü kullanabilirsin.
      </Text>
      <Button title="Geri dön" variant="ghost" onPress={() => router.back()} />
    </View>
  );
}
