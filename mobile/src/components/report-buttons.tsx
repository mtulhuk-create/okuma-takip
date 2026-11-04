import { useState } from "react";
import { View } from "react-native";
import { useAction } from "@/lib/api";
import { Body, Button, Input, Row } from "./ui";

export function ReportButtons({ groupId, dailyPages, current }: { groupId: string; dailyPages: number; current: number | null }) {
  const action = useAction();
  const [custom, setCustom] = useState(false);
  const [pages, setPages] = useState(String(current ?? dailyPages));
  const [busy, setBusy] = useState<string | null>(null);

  async function send(choice: "min" | "none" | "pages") {
    setBusy(choice);
    try {
      await action.mutateAsync({ name: "reportReading", body: { groupId, choice, pages: choice === "pages" ? pages : undefined } });
      setCustom(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {current != null && (
        <Body>
          Bugün bildirdiğin: <Body style={{ fontFamily: "Poppins_700Bold" }}>{current}</Body> / {dailyPages} sayfa {current >= dailyPages ? "✅" : "⚠️"}
        </Body>
      )}
      {custom ? (
        <Row>
          <Input value={pages} onChangeText={setPages} keyboardType="number-pad" autoFocus style={{ minWidth: 90 }} />
          <Button title="Kaydet" variant="success" onPress={() => send("pages")} loading={busy === "pages"} />
          <Button title="Vazgeç" variant="ghost" onPress={() => setCustom(false)} />
        </Row>
      ) : (
        <>
          <Row>
            <Button title="📖 Okudum" variant="success" onPress={() => setCustom(true)} style={{ flex: 1 }} />
            <Button title="❌ Okumadım" variant="ghost" onPress={() => send("none")} loading={busy === "none"} style={{ flex: 1 }} />
          </Row>
          <Button title={`✅ Alt sınırı okudum (${dailyPages} sayfa)`} onPress={() => send("min")} loading={busy === "min"} />
        </>
      )}
    </View>
  );
}
