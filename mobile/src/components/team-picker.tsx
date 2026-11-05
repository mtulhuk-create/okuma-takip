import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { fonts, useColors } from "@/lib/theme";
import { describePenalty, type Rules } from "@/lib/types";
import { Label } from "./ui";

type TeamOption = { id: string; name: string } & Partial<Pick<Rules, "targetPages" | "minPages" | "penaltyMode" | "penaltyAmount" | "minDiscount">>;

/** Ekipli gruplarda ekip seçimi; kurallar biliniyorsa her ekibin günlük hedefi de görünür */
export function TeamPicker({ teams, value, onChange, label = "Ekibini seç" }: { teams: TeamOption[]; value: string | null; onChange: (id: string) => void; label?: string }) {
  const c = useColors();
  const detailed = teams.some((t) => t.targetPages != null);
  return (
    <View>
      <Label>{label}</Label>
      <View style={{ flexDirection: detailed ? "column" : "row", flexWrap: "wrap", gap: 8 }}>
        {teams.map((t) => {
          const active = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: detailed ? 12 : 99,
                borderWidth: 1.5,
                borderColor: active ? c.primary : c.border,
                backgroundColor: active ? c.primary + "14" : c.card,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: active ? c.primary : c.mutedForeground, backgroundColor: active ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                {active && <Check size={11} color="#fff" strokeWidth={3} />}
              </View>
              <View style={{ flex: detailed ? 1 : undefined }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{t.name}</Text>
                {t.targetPages != null && t.penaltyMode && (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>
                    {describePenalty({ penaltyMode: t.penaltyMode, penaltyAmount: t.penaltyAmount ?? 0, minDiscount: t.minDiscount ?? 0 })}
                  </Text>
                )}
              </View>
              {t.targetPages != null && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>{t.targetPages} sf</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>günlük · alt {t.minPages}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
