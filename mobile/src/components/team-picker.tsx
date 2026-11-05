import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { fonts, useColors } from "@/lib/theme";
import { Label } from "./ui";

/** Ekipli gruplarda ekip seçimi (yatay çipler) */
export function TeamPicker({ teams, value, onChange, label = "Ekibini seç" }: { teams: { id: string; name: string }[]; value: string | null; onChange: (id: string) => void; label?: string }) {
  const c = useColors();
  return (
    <View>
      <Label>{label}</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {teams.map((t) => {
          const active = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + "14" : c.card, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              {active && <Check size={14} color={c.primary} strokeWidth={3} />}
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>{t.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
