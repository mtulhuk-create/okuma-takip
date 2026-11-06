import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Check, Copy, Landmark, Wallet, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "@/lib/api";
import { fonts, useColors } from "@/lib/theme";
import type { Debt } from "@/lib/types";
import { DueBadge } from "./due-badge";
import { Row } from "./ui";

const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

function CopyIban({ iban }: { iban: string }) {
  const c = useColors();
  const [done, setDone] = useState(false);
  return (
    <Pressable
      hitSlop={6}
      onPress={async () => {
        await Clipboard.setStringAsync(iban);
        setDone(true);
        toast("IBAN kopyalandı");
        setTimeout(() => setDone(false), 1500);
      }}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c.card }}
    >
      {done ? <Check size={13} color={c.success} /> : <Copy size={13} color={c.foreground} />}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: c.foreground }}>{done ? "Kopyalandı" : "Kopyala"}</Text>
    </Pressable>
  );
}

/** Alttan açılan ödeme penceresi: borcu olan grupların IBAN bilgileri alt alta */
export function PaySheet({ visible, items, title, onClose }: { visible: boolean; items: Debt[]; title: string; onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "#0007", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", paddingBottom: insets.bottom + 12 }}>
          <Row style={{ padding: 16, paddingBottom: 10 }}>
            <Wallet size={20} color={c.primary} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: c.foreground }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={c.mutedForeground} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {items.length === 0 && <Text style={{ textAlign: "center", paddingVertical: 24, fontFamily: fonts.regular, color: c.mutedForeground }}>Ödenmemiş cezan yok 🎉</Text>}
            {items.map((d) => (
              <View key={d.group.id} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, gap: 8 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      onClose();
                      router.push(`/group/${d.group.id}/info`);
                    }}
                  >
                    <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>
                      {d.group.name}
                    </Text>
                  </Pressable>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: c.destructive }}>{d.amount} TL</Text>
                </Row>
                {d.due ? <DueBadge due={d.due} /> : <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Henüz vade verilmedi</Text>}
                {d.group.iban ? (
                  <View style={{ backgroundColor: c.muted, borderRadius: 10, padding: 10, gap: 4 }}>
                    <Row gap={4}>
                      <Landmark size={11} color={c.mutedForeground} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: c.mutedForeground }}>GRUP KASASI IBAN</Text>
                    </Row>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Text selectable style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>
                        {formatIban(d.group.iban)}
                      </Text>
                      <CopyIban iban={d.group.iban} />
                    </Row>
                    {!!d.group.ibanName && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.foreground }}>{d.group.ibanName}</Text>}
                  </View>
                ) : (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>Yönetici henüz IBAN girmedi.</Text>
                )}
              </View>
            ))}
            <Text style={{ textAlign: "center", fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>Ödedikten sonra grup bilgisinden “Ödedim” demeyi unutma.</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Bugün başlığındaki toplam borç; dokununca IBAN'lar açılır */
export function DebtButton({ total, items }: { total: number; items: Debt[] }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const color = total ? c.destructive : c.success;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: color + "1a", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
        <Wallet size={15} color={color} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color }}>{total ? `${total} TL borç` : "Borç yok"}</Text>
      </Pressable>
      <PaySheet visible={open} title="Borçlarım" items={items} onClose={() => setOpen(false)} />
    </>
  );
}
