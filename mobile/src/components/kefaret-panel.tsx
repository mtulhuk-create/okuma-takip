import { BookHeart, Info, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAction, useApi } from "@/lib/api";
import { fonts, KEFARET, useColors } from "@/lib/theme";
import { Card, Muted, Row } from "./ui";
import { showAlert } from "@/lib/dialog";
import { formatAmount } from "@/lib/types";

type KRow = { userId: string; name: string; teamName: string | null; penaltyTotal: number; discountTotal: number; pages: number; target: number; unit?: "PAGES" | "MINUTES"; dailyExtra: number; days: number; active: boolean };
type KPlan = { id: string; name: string; status: "ACTIVE" | "DONE"; discountPercent: number; discountTotal: number; earned: number; dailyExtra: number; days: number; doneDays: number };
type KData = { discount: number; raise: number; maxDays: number; pageValue: number; rows: KRow[]; plans: KPlan[] };

const DISCOUNTS = [25, 50, 75, 100];
const RAISES = [25, 50, 100];

function Pills({ values, value, onChange }: { values: number[]; value: number; onChange: (v: number) => void }) {
  const c = useColors();
  return (
    <Row gap={6} style={{ flexWrap: "wrap" }}>
      {values.map((v) => (
        <Pressable key={v} onPress={() => onChange(v)} style={{ paddingHorizontal: 12, height: 32, justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: value === v ? KEFARET : c.border, backgroundColor: value === v ? KEFARET : c.card }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: value === v ? "#fff" : c.foreground }}>%{v}</Text>
        </Pressable>
      ))}
    </Row>
  );
}

/** Kefaret okumasıyla indirim: üyeler hedeflerinin üstüne okuyarak indirimi kazanır */
export function KefaretPanel({ groupId }: { groupId: string }) {
  const c = useColors();
  const action = useAction();
  const [discount, setDiscount] = useState(50);
  const [raise, setRaise] = useState(50);
  const [how, setHow] = useState(false);
  const { data, isFetching } = useApi<KData>(`/api/m/groups/${groupId}/kefaret?discount=${discount}&raise=${raise}`);
  const todo = data?.rows.filter((r) => !r.active) ?? [];
  const active = data?.plans.filter((p) => p.status === "ACTIVE") ?? [];
  const cell = { fontFamily: fonts.regular, fontSize: 11, color: c.foreground } as const;

  return (
    <Card style={{ gap: 10, borderWidth: 1, borderColor: KEFARET + "55" }}>
      <Row gap={10} style={{ alignItems: "flex-start" }}>
        <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: KEFARET, alignItems: "center", justifyContent: "center" }}>
          <BookHeart size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.foreground }}>Kefaret okumasıyla indirim</Text>
          <Muted>İndirim cezadan doğrudan düşülmez: üyeler günlük hedeflerinin üstüne okuyarak kazanır. İstemeyen normal okumaya devam eder.</Muted>
        </View>
        <Pressable hitSlop={8} onPress={() => setHow((v) => !v)} accessibilityLabel="Nasıl hesaplanıyor?">
          <Info size={18} color={c.mutedForeground} />
        </Pressable>
      </Row>
      {how && (
        <View style={{ gap: 4, backgroundColor: KEFARET + "18", borderRadius: 10, padding: 10 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: KEFARET }}>Adil hesap nasıl yapılıyor?</Text>
          <Text style={{ ...cell, lineHeight: 16 }}>1. Grubun ödenmemiş cezalarında eksik kalan toplam sayfa toplam cezaya bölünür: 1 TL = {data?.pageValue ?? "…"} sayfa. Bu ölçü hangi ekipte olursa olsun herkes için aynıdır.</Text>
          <Text style={{ ...cell, lineHeight: 16 }}>2. Herkesin indirimi kendi cezasının yüzdesidir; cezası 4 kat olan 4 kat sayfa okur.</Text>
          <Text style={{ ...cell, lineHeight: 16 }}>3. Ek sayfa her kişinin kendi günlük hedefine zam olarak eklenir; kaç gün süreceği buna göre çıkar.</Text>
          <Text style={{ ...cell, lineHeight: 16 }}>4. Her kefaret günü indirimin bir payını kazandırır; bıraksa da kazandığı geçerlidir.</Text>
        </View>
      )}
      <Muted>Cezalara indirim</Muted>
      <Pills values={DISCOUNTS} value={discount} onChange={setDiscount} />
      <Muted>Günlük hedefe zam</Muted>
      <Pills values={RAISES} value={raise} onChange={setRaise} />

      {!data ? (
        <Muted>Hesaplanıyor…</Muted>
      ) : !data.rows.length ? (
        <Muted>İndirim yapılacak ödenmemiş ceza yok.</Muted>
      ) : (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: "hidden", opacity: isFetching ? 0.6 : 1 }}>
          <Row style={{ backgroundColor: c.muted, paddingHorizontal: 8, paddingVertical: 5 }}>
            {["Üye", "Ceza", "İndirim", "Günlük", "Gün"].map((h, i) => (
              <Text key={h} style={{ flex: i === 0 ? 2 : 1, textAlign: i === 0 ? "left" : "right", fontFamily: fonts.semibold, fontSize: 10, color: c.mutedForeground }}>
                {h}
              </Text>
            ))}
          </Row>
          {data.rows.map((r) => (
            <Row key={r.userId} style={{ paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border, opacity: r.active ? 0.55 : 1 }}>
              <View style={{ flex: 2 }}>
                <Text numberOfLines={1} style={{ ...cell, fontFamily: fonts.semibold }}>
                  {r.name}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 9, color: c.mutedForeground }}>
                  {r.active ? "süren kefareti var" : `${formatAmount(r.pages, r.unit)} kefaret${r.teamName ? ` · ${r.teamName}` : ""}`}
                </Text>
                {/* Kişiye özel: yalnızca bu üyeye teklif */}
                {!r.active && (
                  <Pressable
                    disabled={action.isPending}
                    hitSlop={6}
                    onPress={() =>
                      showAlert("Kişiye özel kefaret", `${r.name} için %${discount} indirimli kefaret okuması başlatılsın mı?`, [
                        { text: "Vazgeç", style: "cancel" },
                        { text: "Başlat", onPress: () => action.mutate({ name: "startKefaret", body: { groupId, discount, raise, userId: r.userId } }) },
                      ])
                    }
                    style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 3, borderWidth: 1, borderColor: KEFARET, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 1, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: KEFARET }}>Başlat</Text>
                  </Pressable>
                )}
              </View>
              <Text style={{ ...cell, flex: 1, textAlign: "right" }}>{r.penaltyTotal} TL</Text>
              <Text style={{ ...cell, flex: 1, textAlign: "right", fontFamily: fonts.bold, color: KEFARET }}>{r.discountTotal} TL</Text>
              <Text style={{ ...cell, flex: 1, textAlign: "right" }}>
                {formatAmount(r.target + r.dailyExtra, r.unit)}
              </Text>
              <Text style={{ ...cell, flex: 1, textAlign: "right", fontFamily: fonts.bold, color: r.days > data.maxDays ? c.destructive : c.foreground }}>{r.days}</Text>
            </Row>
          ))}
        </View>
      )}

      {todo.length > 0 && (
        <Pressable
          disabled={action.isPending}
          onPress={() =>
            showAlert("Kefaret okuması", `${todo.length} kişiye %${discount} indirim için günlük hedefe %${raise} zamla kefaret okuması başlatılsın mı?`, [
              { text: "Vazgeç", style: "cancel" },
              { text: "Başlat", onPress: () => action.mutate({ name: "startKefaret", body: { groupId, discount, raise } }) },
            ])
          }
          style={({ pressed }) => ({ height: 42, borderRadius: 10, backgroundColor: KEFARET, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed || action.isPending ? 0.8 : 1 })}
        >
          <BookHeart size={16} color="#fff" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#fff" }}>{todo.length === 1 ? "Kefaret okumasını başlat" : `Hepsine başlat (${todo.length} kişi)`}</Text>
        </Pressable>
      )}

      {active.length > 0 && (
        <View style={{ gap: 6 }}>
          <Muted>Süren kefaret okumaları</Muted>
          {active.map((p) => (
            <Row key={p.id} gap={8} style={{ backgroundColor: KEFARET + "18", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ ...cell, fontFamily: fonts.semibold }}>
                  {p.name}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>
                  %{p.discountPercent} · günde +{p.dailyExtra} sf · {p.doneDays}/{p.days} gün · {p.earned}/{p.discountTotal} TL
                </Text>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: c.muted, overflow: "hidden" }}>
                  <View style={{ width: `${Math.round((p.doneDays / p.days) * 100)}%`, height: "100%", backgroundColor: KEFARET }} />
                </View>
              </View>
              <Pressable
                hitSlop={8}
                accessibilityLabel="Durdur"
                onPress={() =>
                  showAlert("Durdurulsun mu?", `${p.name} için kefaret okuması durdurulsun mu? Kazanılan indirim geçerli kalır.`, [
                    { text: "Vazgeç", style: "cancel" },
                    { text: "Durdur", style: "destructive", onPress: () => action.mutate({ name: "cancelKefaret", body: { planId: p.id } }) },
                  ])
                }
              >
                <X size={18} color={c.mutedForeground} />
              </Pressable>
            </Row>
          ))}
        </View>
      )}
    </Card>
  );
}
