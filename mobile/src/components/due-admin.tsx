import { BadgePercent, Hourglass } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAction } from "@/lib/api";
import { toLocalInput } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import { DateTimeField } from "./pickers";
import { Button, Row } from "./ui";

/** Vadeye ek süre: hızlı +1/+3/+7 gün ya da istenen tarih */
export function ExtendControls({ dueId, tzOffset, from }: { dueId: string; tzOffset: number; from?: string }) {
  const c = useColors();
  const action = useAction();
  // Varsayılan: vade (geçtiyse şimdi) + 3 gün
  const [at, setAt] = useState(() => new Date(Math.max(Date.now(), from ? new Date(from).getTime() : 0) + 3 * 86_400_000));
  const busy = (k: string) => action.isPending && action.variables?.body?.key === `${dueId}-${k}`;
  return (
    <View style={{ gap: 6, backgroundColor: "#f59e0b1f", borderRadius: 10, padding: 8 }}>
      <Row gap={6}>
        <Hourglass size={14} color={c.warning} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.warning }}>Ek süre ver</Text>
      </Row>
      <Row gap={6} style={{ flexWrap: "wrap" }}>
        {[1, 3, 7].map((d) => (
          <Button key={d} title={`+${d} gün`} small variant="ghost" loading={busy(`d${d}`)} onPress={() => action.mutate({ name: "extendDue", body: { dueId, days: d, key: `${dueId}-d${d}` } })} />
        ))}
      </Row>
      <DateTimeField label="Ya da tarih seç" value={at} onChange={setAt} />
      <Button title="Bu tarihe uzat" small variant="ghost" loading={busy("at")} onPress={() => action.mutate({ name: "extendDue", body: { dueId, dueAt: toLocalInput(at, tzOffset), key: `${dueId}-at` } })} />
    </View>
  );
}

/** Ceza indirimi (% ya da TL): penaltyId → tek ceza, userId → kişinin tüm cezaları, ikisi de yoksa tüm grup */
export function DiscountControls({ groupId, userId, penaltyId, title = "İndirim yap", compact }: { groupId: string; userId?: string; penaltyId?: string; title?: string; compact?: boolean }) {
  const c = useColors();
  const action = useAction();
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const key = `disc-${penaltyId ?? userId ?? groupId}`;
  const n = Number(value);
  const ok = Number.isInteger(n) && n > 0 && (mode === "amount" || n <= 100);
  const body = (
    <Row gap={6}>
      <View style={{ flexDirection: "row", borderWidth: 1, borderColor: c.border, borderRadius: 8, overflow: "hidden" }}>
        {(["percent", "amount"] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={{ paddingHorizontal: 10, paddingVertical: 7, backgroundColor: mode === m ? c.primary : c.card }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: mode === m ? c.primaryForeground : c.foreground }}>{m === "percent" ? "%" : "TL"}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={value}
        onChangeText={(v) => setValue(v.replace(/\D/g, "").slice(0, 7))}
        keyboardType="number-pad"
        placeholder={mode === "percent" ? "50" : "20"}
        placeholderTextColor={c.mutedForeground}
        style={{ width: 64, height: 34, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 8, fontFamily: fonts.regular, color: c.foreground, backgroundColor: c.card }}
      />
      <Button
        title={compact ? "İndir" : "Uygula"}
        small
        variant="success"
        disabled={!ok}
        loading={action.isPending && action.variables?.body?.key === key}
        onPress={() => action.mutate({ name: "discount", body: { groupId, userId, penaltyId, mode, value: n, key } }, { onSuccess: () => setValue("") })}
      />
    </Row>
  );
  if (compact) return body;
  return (
    <View style={{ gap: 6, backgroundColor: c.success + "1a", borderRadius: 10, padding: 8 }}>
      <Row gap={6}>
        <BadgePercent size={14} color={c.success} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.success }}>{title}</Text>
      </Row>
      {body}
    </View>
  );
}
