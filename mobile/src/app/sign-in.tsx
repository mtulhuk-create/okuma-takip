import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Button, Card, H1, Muted, Row } from "@/components/ui";
import { useColors } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

const FEATURES = [
  ["🎯", "Günlük sayfa hedefini sen belirle"],
  ["👥", "Herkese açık ya da özel gruplar kur, davet et"],
  ["⏰", "Son saatten önce hatırlatma ve 10 dakikalık geri sayım"],
  ["💸", "Okumayana TL cinsinden ceza, vadesinde ödemeyen gruptan çıkar"],
];

export default function SignInScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { startHostedAuth } = useHostedAuth();
  const [busy, setBusy] = useState<"sign-in" | "sign-up" | null>(null);

  async function start(mode: "sign-in" | "sign-up") {
    setBusy(mode);
    try {
      await startHostedAuth({ mode });
    } catch (e) {
      Alert.alert("Giriş yapılamadı", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 24, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, justifyContent: "space-between" }}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Image source={require("@/assets/images/icon.png")} style={{ width: 112, height: 112, borderRadius: 28 }} />
        <H1 style={{ fontSize: 32 }}>Okuma Takip</H1>
        <Body style={{ textAlign: "center", color: c.mutedForeground }}>Arkadaşlarınla okuma grubu kur. Her gün sayfanı bildir. Hedefin altında kalırsan ceza öde!</Body>
      </View>
      <View style={{ gap: 10 }}>
        {FEATURES.map(([icon, text]) => (
          <Card key={text} style={{ paddingVertical: 12 }}>
            <Row gap={12}>
              <Body style={{ fontSize: 22 }}>{icon}</Body>
              <Body style={{ flex: 1 }}>{text}</Body>
            </Row>
          </Card>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Button title="Hemen başla" onPress={() => start("sign-up")} loading={busy === "sign-up"} />
        <Button title="Giriş yap" variant="ghost" onPress={() => start("sign-in")} loading={busy === "sign-in"} />
        <Muted style={{ textAlign: "center" }}>E-posta ya da Google hesabınla giriş yapabilirsin.</Muted>
      </View>
    </View>
  );
}
