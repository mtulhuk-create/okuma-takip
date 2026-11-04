import RNDateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Pressable, Text, View } from "react-native";
import { formatDateTime, minuteToTime } from "@/lib/format";
import { fonts, radius, useColors } from "@/lib/theme";
import { Label } from "./ui";

function Field({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <Pressable onPress={onPress} style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: radius + 2, padding: 12 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: c.foreground }}>🕐 {value}</Text>
      </Pressable>
    </View>
  );
}

/** Gece yarısından itibaren dakika cinsinden saat seçer (Türkiye saati). */
export function TimeField({ label, minute, onChange }: { label: string; minute: number; onChange: (m: number) => void }) {
  const base = new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60);
  if (Platform.OS !== "android") {
    return (
      <View style={{ flex: 1 }}>
        <Label>{label}</Label>
        <RNDateTimePicker mode="time" value={base} is24Hour onValueChange={(_, d) => onChange(d.getHours() * 60 + d.getMinutes())} />
      </View>
    );
  }
  return (
    <Field
      label={label}
      value={minuteToTime(minute)}
      onPress={() =>
        DateTimePickerAndroid.open({
          mode: "time",
          value: base,
          is24Hour: true,
          onValueChange: (_, d) => onChange(d.getHours() * 60 + d.getMinutes()),
        })
      }
    />
  );
}

/** Vade için tarih + saat seçer. */
export function DateTimeField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  if (Platform.OS !== "android") {
    return (
      <View style={{ flex: 1 }}>
        <Label>{label}</Label>
        <RNDateTimePicker mode="datetime" value={value} minimumDate={new Date()} onValueChange={(_, d) => onChange(d)} />
      </View>
    );
  }
  return (
    <Field
      label={label}
      value={formatDateTime(value)}
      onPress={() =>
        DateTimePickerAndroid.open({
          mode: "date",
          value,
          minimumDate: new Date(),
          onValueChange: (_, day) =>
            DateTimePickerAndroid.open({
              mode: "time",
              value: day,
              is24Hour: true,
              onValueChange: (__, t) => onChange(t),
            }),
        })
      }
    />
  );
}
