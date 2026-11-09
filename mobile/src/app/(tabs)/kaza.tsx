import { Bell, Calculator, Check, ChevronRight, Flame, MoonStar, Target, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, PrayerGrid, StatsTable, UndoBar, useKaza } from "@/components/kaza";
import { Button, Card, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen, Segmented } from "@/components/ui";
import { toast } from "@/lib/api";
import { calcKaza, getKazaStickyPref, KAZA, parseDate, PRAYER_INFO, PRAYERS, setKazaStickyPref, sum, syncKazaCard, type Counts, type KazaState, type Prayer } from "@/lib/kaza";
import { fonts, useColors } from "@/lib/theme";
import { LITE } from "@/lib/variant";
import { kazaNotificationAvailable } from "../../../modules/day-card-notification";

const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

/** Bölüm başlığı */
function Section({ title, right }: { title: string; right?: React.ReactNode }) {
  const c = useColors();
  return (
    <Row style={{ marginTop: 6, marginBottom: -4 }}>
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: c.foreground }}>{title}</Text>
      {right}
    </Row>
  );
}

export default function KazaScreen() {
  const { data, isLoading, error, refetch, isRefetching, op } = useKaza();
  const [calc, setCalc] = useState(false);

  if (isLoading) return <Loading />;
  if (!data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const apply = (counts: Counts, mode: "replace" | "add") =>
    op.mutate(
      { op: "set", counts, mode },
      {
        onSuccess: () => {
          setCalc(false);
          toast(mode === "add" ? "Kazalar eklendi" : "Kalan kazalar güncellendi");
        },
      },
    );

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row gap={12}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: KAZA, alignItems: "center", justifyContent: "center" }}>
          <MoonStar size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <H1>Namaz Kaza</H1>
          <Muted>Geçmiş namazlarını vakit vakit takip et</Muted>
        </View>
      </Row>

      {!data.enabled ? (
        <Intro onEnable={() => op.mutate({ op: "enable", on: true })} pending={op.isPending} />
      ) : (
        <>
          <Summary s={data} onCalc={() => setCalc(true)} />

          <Section title="Vakitler" right={<Muted style={{ fontSize: 11 }}>− kıldım · + kaçırdım</Muted>} />
          <PrayerGrid s={data} op={op} />
          <UndoBar op={op} />

          <Section title="Kılınan kaza" />
          <StatsTable s={data} />

          <Section title="Ayarlar" />
          <Settings s={data} onGoal={(goal) => op.mutate({ op: "goal", goal })} onCalc={() => setCalc(true)} onDisable={() => op.mutate({ op: "enable", on: false })} />
          <CalcSheet open={calc} s={data} onClose={() => setCalc(false)} onApply={apply} />
        </>
      )}
    </Screen>
  );
}

/** Özellik kapalıyken: kısa tanıtım ve "Kaza namazım var" anahtarı */
function Intro({ onEnable, pending }: { onEnable: () => void; pending: boolean }) {
  const c = useColors();
  const items = [
    { Icon: Calculator, text: "Buluğdan bu yana kazanı toplu hesapla" },
    { Icon: Check, text: "Kıldıkça tek dokunuşla düş, vakit vakit gör" },
    { Icon: Target, text: "Günlük hedef koy, bitiş tarihini öğren" },
    ...(!LITE ? [{ Icon: Bell, text: "Bildirim panelinden uygulamayı açmadan işaretle" }] : []),
  ];
  return (
    <Card style={{ gap: 14, borderColor: KAZA + "44" }}>
      <View style={{ gap: 10 }}>
        {items.map(({ Icon, text }) => (
          <Row key={text} gap={10}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: KAZA + "1f", alignItems: "center", justifyContent: "center" }}>
              <Icon size={16} color={KAZA} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: c.foreground }}>{text}</Text>
          </Row>
        ))}
      </View>
      <Pressable
        disabled={pending}
        onPress={onEnable}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: KAZA, backgroundColor: pressed ? KAZA + "22" : KAZA + "10" })}
      >
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: KAZA, alignItems: "center", justifyContent: "center" }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.foreground }}>Kaza namazım var</Text>
          <Muted>İşaretleyince kaza takibi açılır</Muted>
        </View>
      </Pressable>
    </Card>
  );
}

/** Özet: kalan toplam, ilerleme, bugün, seri ve bitiş tahmini */
function Summary({ s, onCalc }: { s: KazaState; onCalc: () => void }) {
  const c = useColors();
  const left = sum(s.remaining);
  const made = sum(s.made);
  const pct = left + made ? Math.round((made / (left + made)) * 100) : 0;
  // Bitiş: sunucunun bugününden (son 14 günün sonu) günlük hedefe göre
  const today = Date.parse(s.week[s.week.length - 1]?.dayKey ?? "");
  const finish = s.dailyGoal > 0 && left > 0 && !isNaN(today) ? new Date(today + Math.ceil(left / s.dailyGoal) * 86_400_000) : null;
  if (left + made === 0)
    return (
      <Card style={{ gap: 10, borderColor: KAZA + "44" }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Önce kazanı belirle</Text>
        <Muted>Buluğdan bu yana kılamadığın namazları toplu hesapla ya da sayıları elle gir.</Muted>
        <Button title="Kaza hesapla" icon={Calculator} style={{ backgroundColor: KAZA, borderColor: KAZA }} onPress={onCalc} />
      </Card>
    );
  const stat = (label: string, value: string) => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>
        {value}
      </Text>
    </View>
  );
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>Kalan kaza</Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 40, color: KAZA }}>{fmt(left)}</Text>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.mutedForeground, marginBottom: 6 }}>
          {fmt(made)} kılındı · %{pct}
        </Text>
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.muted, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: KAZA }} />
      </View>
      <Row gap={12} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
        {stat("Bugün", s.dailyGoal ? `${s.today} / ${s.dailyGoal}` : String(s.today))}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Seri</Text>
          <Row gap={3}>
            <Flame size={13} color={s.streak ? "#f97316" : c.mutedForeground} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>{s.streak} gün</Text>
          </Row>
        </View>
        {stat("Tahmini bitiş", finish ? fmtDate(finish) : left ? "hedef koy" : "bitti")}
      </Row>
    </Card>
  );
}

/** Ayarlar: günlük hedef, hesaplama, bildirim kartı, kapat */
function Settings({ s, onGoal, onCalc, onDisable }: { s: KazaState; onGoal: (g: number) => void; onCalc: () => void; onDisable: () => void }) {
  const c = useColors();
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    getKazaStickyPref().then(setSticky);
  }, []);
  const rowStyle = { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border } as const;
  const icon = (I: typeof Bell) => (
    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: KAZA + "1a", alignItems: "center", justifyContent: "center" }}>
      <I size={16} color={KAZA} />
    </View>
  );
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
        <Row gap={10}>
          {icon(Target)}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Günlük hedef</Text>
            <Muted>Bitiş tarihi buna göre hesaplanır</Muted>
          </View>
        </Row>
        <Chips values={[0, 1, 2, 3, 6, 12]} value={s.dailyGoal} onChange={onGoal} render={(g) => (g === 0 ? "Yok" : String(g))} />
      </View>
      <Pressable onPress={onCalc} style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? c.muted : "transparent" }]}>
        <Row gap={10}>
          {icon(Calculator)}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Kaza hesapla</Text>
            <Muted>Toplu hesapla ya da sayıları elle düzenle</Muted>
          </View>
          <ChevronRight size={18} color={c.mutedForeground} />
        </Row>
      </Pressable>
      {!LITE && kazaNotificationAvailable && (
        <View style={rowStyle}>
          <Row gap={10}>
            {icon(Bell)}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Bildirim panelinde göster</Text>
              <Muted>Uygulamayı açmadan kıldım / kaçırdım</Muted>
            </View>
            <Switch
              value={sticky}
              onValueChange={async (v) => {
                setSticky(v);
                await setKazaStickyPref(v);
                await syncKazaCard(s);
              }}
              trackColor={{ true: KAZA + "88", false: c.muted }}
              thumbColor={sticky ? KAZA : "#f4f4f5"}
            />
          </Row>
        </View>
      )}
      <Pressable
        onPress={() =>
          Alert.alert("Kaza takibi kapatılsın mı?", "Sayıların silinmez; istediğinde yeniden açabilirsin.", [
            { text: "Vazgeç", style: "cancel" },
            { text: "Kapat", style: "destructive", onPress: onDisable },
          ])
        }
        style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? c.muted : "transparent" }]}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.destructive, textAlign: "center" }}>Kaza takibini kapat</Text>
      </Pressable>
    </Card>
  );
}

/** Kaza hesaplama penceresi: toplu hesap ya da elle giriş */
function CalcSheet({ open, s, onClose, onApply }: { open: boolean; s: KazaState; onClose: () => void; onApply: (counts: Counts, mode: "replace" | "add") => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"calc" | "manual">("calc");
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: c.foreground }}>Kaza hesapla</Text>
          <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Kapat">
            <X size={22} color={c.foreground} />
          </Pressable>
        </Row>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "calc", label: "Toplu hesapla" },
              { value: "manual", label: "Elle gir" },
            ]}
          />
          {tab === "calc" ? <Calc onApply={onApply} /> : <Manual s={s} onApply={onApply} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Chips<T extends number>({ values, value, onChange, render }: { values: T[]; value: T; onChange: (v: T) => void; render?: (v: T) => string }) {
  const c = useColors();
  return (
    <Row gap={6} style={{ flexWrap: "wrap" }}>
      {values.map((v) => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onChange(v)} style={{ paddingHorizontal: 12, height: 32, justifyContent: "center", borderRadius: 8, borderWidth: 1.5, borderColor: on ? KAZA : c.border, backgroundColor: on ? KAZA : c.card }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: on ? "#fff" : c.foreground }}>{render ? render(v) : v}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

function Calc({ onApply }: { onApply: (counts: Counts, mode: "replace" | "add") => void }) {
  const c = useColors();
  const [gender, setGender] = useState<"m" | "f">("m");
  const [birth, setBirth] = useState("");
  const [bulugh, setBulugh] = useState(15);
  const [start, setStart] = useState(fmtDate(new Date()));
  const [prayed, setPrayed] = useState(0);
  const [hayiz, setHayiz] = useState(7);
  const [nifas, setNifas] = useState("");
  const [vitir, setVitir] = useState(true);
  const b = parseDate(birth);
  const st = parseDate(start);
  const r = b && st ? calcKaza({ female: gender === "f", birth: b, bulugh, start: st, prayedPercent: prayed, hayiz, nifas: Math.max(0, Number(nifas) || 0), vitir }) : null;
  const row = (k: string, v: string, strong?: boolean) => (
    <Row key={k}>
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>{k}</Text>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.semibold, fontSize: strong ? 15 : 12, color: strong ? KAZA : c.foreground }}>{v}</Text>
    </Row>
  );
  return (
    <View style={{ gap: 12 }}>
      <Segmented
        value={gender}
        onChange={setGender}
        options={[
          { value: "m", label: "Erkek" },
          { value: "f", label: "Kadın" },
        ]}
      />
      <Input label="Doğum tarihi" value={birth} onChangeText={setBirth} placeholder="GG.AA.YYYY ya da yıl (1990)" keyboardType="numbers-and-punctuation" />
      <View>
        <Label>Buluğ yaşı</Label>
        <Chips values={[9, 10, 11, 12, 13, 14, 15]} value={bulugh} onChange={setBulugh} />
        <Muted style={{ marginTop: 4 }}>Ne zaman buluğa erdiğini bilmiyorsan 15 seç.</Muted>
      </View>
      <Input label="Namaza düzenli başladığın tarih" value={start} onChangeText={setStart} placeholder="GG.AA.YYYY" keyboardType="numbers-and-punctuation" />
      <View>
        <Label>Bu sürede kıldığın namaz (yaklaşık)</Label>
        <Chips values={[0, 10, 25, 50, 75]} value={prayed} onChange={setPrayed} render={(v) => `%${v}`} />
      </View>
      {gender === "f" && (
        <>
          <View>
            <Label>Aylık ortalama hayız günü</Label>
            <Chips values={[3, 4, 5, 6, 7, 8, 9, 10]} value={hayiz} onChange={setHayiz} />
          </View>
          <Input label="Toplam nifas (lohusalık) günü" value={nifas} onChangeText={setNifas} placeholder="Örn. 2 doğum × 40 = 80" keyboardType="number-pad" />
        </>
      )}
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>Vitir dahil</Text>
          <Muted>Hanefi mezhebinde vitir vaciptir, kazası kılınır</Muted>
        </View>
        <Switch value={vitir} onValueChange={setVitir} trackColor={{ true: KAZA + "88", false: c.muted }} thumbColor={vitir ? KAZA : "#f4f4f5"} />
      </Row>

      {r ? (
        <View style={{ gap: 6, padding: 12, borderRadius: 12, backgroundColor: KAZA + "10", borderWidth: 1, borderColor: KAZA + "33" }}>
          {row("Buluğ tarihi", fmtDate(r.bulughAt))}
          {row("Geçen gün", fmt(r.days))}
          {gender === "f" && row("Hayız ve nifas (düşülen)", `−${fmt(r.exempt)} gün`)}
          {prayed > 0 && row(`Kılınan (%${prayed})`, `−${fmt(r.due - r.perPrayer)} gün`)}
          {row("Her vakit için kaza", fmt(r.perPrayer))}
          {row("Toplam kaza namazı", fmt(r.total), true)}
          <Row gap={8} style={{ marginTop: 6 }}>
            <Button
              title="Kalan kazam bu olsun"
              small
              style={{ flex: 1, backgroundColor: KAZA, borderColor: KAZA }}
              disabled={!r.total}
              onPress={() =>
                Alert.alert("Kalan kazaların değişsin mi?", `Her vakit için ${fmt(r.perPrayer)} kaza yazılacak. Kılınan sayıların korunur.`, [
                  { text: "Vazgeç", style: "cancel" },
                  { text: "Evet", onPress: () => onApply(r.counts, "replace") },
                ])
              }
            />
            <Button title="Mevcuda ekle" small variant="ghost" style={{ flex: 1 }} disabled={!r.total} onPress={() => onApply(r.counts, "add")} />
          </Row>
        </View>
      ) : (
        <Muted>Hesap için doğum tarihini ve namaza başladığın tarihi gir.</Muted>
      )}
      <Muted style={{ fontSize: 10.5, lineHeight: 15 }}>
        Hesap: buluğ tarihinden namaza düzenli başladığın tarihe kadar geçen günler{gender === "f" ? ", hayız ve nifas günleri düşülerek" : ""}, kıldığın oran çıkarıldıktan sonra her vakit (beş vakit farz{vitir ? " ve vitir" : ""}) için birer kaza sayılır. Hanefi mezhebine göredir; kesin hüküm için müftülüğe danış.
      </Muted>
    </View>
  );
}

function Manual({ s, onApply }: { s: KazaState; onApply: (counts: Counts, mode: "replace" | "add") => void }) {
  const [v, setV] = useState<Record<Prayer, string>>(() => Object.fromEntries(PRAYERS.map((p) => [p, String(s.remaining[p] || "")])) as Record<Prayer, string>);
  const counts = Object.fromEntries(PRAYERS.map((p) => [p, Math.max(0, Math.floor(Number(v[p]) || 0))])) as Counts;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PRAYERS.map((p) => (
          <View key={p} style={{ width: "48%" }}>
            <Input label={PRAYER_INFO[p].label} value={v[p]} onChangeText={(t) => setV((o) => ({ ...o, [p]: t.replace(/\D/g, "") }))} keyboardType="number-pad" placeholder="0" />
          </View>
        ))}
      </View>
      <Button title="Kalan kazalarımı kaydet" small style={{ backgroundColor: KAZA, borderColor: KAZA }} onPress={() => onApply(counts, "replace")} />
    </View>
  );
}
