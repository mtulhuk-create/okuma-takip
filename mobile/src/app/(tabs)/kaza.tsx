import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Calculator, Check, ChevronDown, ChevronUp, Flame, MoonStar, RotateCcw, Target } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Button, Card, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen, Segmented } from "@/components/ui";
import { toast, useApi, useApiFetch } from "@/lib/api";
import { calcKaza, getKazaStickyPref, KAZA, parseDate, PRAYER_INFO, PRAYERS, setKazaStickyPref, sum, syncKazaCard, type Counts, type KazaState, type Prayer } from "@/lib/kaza";
import { fonts, useColors } from "@/lib/theme";
import { LITE } from "@/lib/variant";
import { kazaNotificationAvailable } from "../../../modules/day-card-notification";

const PATH = "/api/m/kaza";
type Op =
  | { op: "enable"; on: boolean }
  | { op: "make" | "undo"; prayer: Prayer }
  | { op: "set"; counts: Partial<Counts>; mode: "replace" | "add" }
  | { op: "goal"; goal: number };

const fmt = (n: number) => n.toLocaleString("tr-TR");
const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

/** Kaza işlemi; "kıldım" ve "geri al" anında ekrana yansır, sunucu yanıtı kesinleştirir */
function useKazaOp() {
  const fetcher = useApiFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Op) => fetcher<KazaState>(PATH, { method: "POST", body: JSON.stringify(body) }),
    onMutate: async (body) => {
      if (body.op !== "make" && body.op !== "undo") return;
      await qc.cancelQueries({ queryKey: [PATH] });
      const prev = qc.getQueryData<KazaState>([PATH]);
      if (prev) {
        const d = body.op === "make" ? 1 : -1;
        qc.setQueryData<KazaState>([PATH], {
          ...prev,
          remaining: { ...prev.remaining, [body.prayer]: Math.max(0, prev.remaining[body.prayer] - d) },
          made: { ...prev.made, [body.prayer]: Math.max(0, prev.made[body.prayer] + d) },
          today: Math.max(0, prev.today + d),
        });
      }
      return { prev };
    },
    onError: (e, _b, ctx) => {
      if (ctx?.prev) qc.setQueryData([PATH], ctx.prev);
      Alert.alert("İşlem yapılamadı", e.message);
    },
    // Token yalnızca GET'te gelir; korunur
    onSuccess: (s) => qc.setQueryData<KazaState>([PATH], (old) => ({ ...s, token: old?.token })),
  });
}

export default function KazaScreen() {
  const c = useColors();
  const { data, isLoading, error, refetch, isRefetching } = useApi<KazaState>(PATH);
  const op = useKazaOp();

  // Bildirim panelindeki kaza kartı sayfadaki sayılarla aynı kalsın
  useEffect(() => {
    syncKazaCard(data).catch(() => {});
  }, [data]);

  if (isLoading) return <Loading />;
  if (!data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;

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
          <Hero s={data} />
          <PrayerList s={data} op={op} />
          <Week s={data} />
          <Goal s={data} onChange={(goal) => op.mutate({ op: "goal", goal })} />
          {!LITE && kazaNotificationAvailable && <StickyToggle s={data} />}
          <CalcCard s={data} onApply={(counts, mode) => op.mutate({ op: "set", counts, mode }, { onSuccess: () => toast(mode === "add" ? "Kazalar eklendi" : "Kalan kazalar güncellendi") })} />
          <Pressable
            hitSlop={8}
            onPress={() =>
              Alert.alert("Kaza takibi kapatılsın mı?", "Sayıların silinmez; istediğinde yeniden açabilirsin.", [
                { text: "Vazgeç", style: "cancel" },
                { text: "Kapat", style: "destructive", onPress: () => op.mutate({ op: "enable", on: false }) },
              ])
            }
            style={{ alignSelf: "center", paddingVertical: 6 }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.mutedForeground }}>Kaza takibini kapat</Text>
          </Pressable>
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
function Hero({ s }: { s: KazaState }) {
  const left = sum(s.remaining);
  const made = sum(s.made);
  const pct = left + made ? Math.round((made / (left + made)) * 100) : 0;
  // Bugün sunucunun gününden (son 14 günün sonu) sayılır
  const today = Date.parse(s.week[s.week.length - 1]?.dayKey ?? "");
  const finish = s.dailyGoal > 0 && left > 0 && !isNaN(today) ? new Date(today + Math.ceil(left / s.dailyGoal) * 86_400_000) : null;
  const white = { color: "#fff" } as const;
  const soft = { fontFamily: fonts.regular, fontSize: 11, color: "#ffffffcc" } as const;
  return (
    <View style={{ borderRadius: 16, padding: 16, gap: 12, backgroundColor: KAZA, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: -24, top: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: "#ffffff14" }} />
      <View>
        <Text style={soft}>Kalan kaza</Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 34, lineHeight: 42, ...white }}>{fmt(left)}</Text>
        <Text style={soft}>
          {fmt(made)} kılındı · %{pct}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "#ffffff33", overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: "#fff", borderRadius: 4 }} />
      </View>
      <Row gap={8}>
        {[
          { label: "Bugün", value: s.dailyGoal ? `${s.today}/${s.dailyGoal}` : String(s.today) },
          { label: "Seri", value: `${s.streak} gün`, Icon: Flame },
          { label: "Bitiş", value: finish ? fmtDate(finish) : left ? "hedef koy" : "bitti 🎉" },
        ].map((x) => (
          <View key={x.label} style={{ flex: 1, backgroundColor: "#ffffff1f", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
            <Text style={soft}>{x.label}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14, ...white }}>
              {x.value}
            </Text>
          </View>
        ))}
      </Row>
    </View>
  );
}

/** Vakitler: kalan sayı, ilerleme, "Kıldım" ve geri al */
function PrayerList({ s, op }: { s: KazaState; op: ReturnType<typeof useKazaOp> }) {
  const c = useColors();
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {PRAYERS.map((p, i) => {
        const { label, Icon, color } = PRAYER_INFO[p];
        const left = s.remaining[p];
        const made = s.made[p];
        const pct = left + made ? (made / (left + made)) * 100 : 0;
        return (
          <Row key={p} gap={12} style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: color + "1f", alignItems: "center", justifyContent: "center" }}>
              <Icon size={19} color={color} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Row gap={6}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>{label}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color }}>{fmt(left)}</Text>
              </Row>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: c.muted, overflow: "hidden" }}>
                <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} />
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>{fmt(made)} kılındı</Text>
            </View>
            <Pressable
              hitSlop={6}
              disabled={!made}
              accessibilityLabel={`${label}: geri al`}
              onPress={() => op.mutate({ op: "undo", prayer: p })}
              style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", opacity: made ? (pressed ? 0.5 : 1) : 0.3 })}
            >
              <RotateCcw size={16} color={c.mutedForeground} />
            </Pressable>
            <Pressable
              disabled={!left}
              accessibilityLabel={`${label} kazası kıldım`}
              onPress={() => op.mutate({ op: "make", prayer: p })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                height: 34,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: color,
                backgroundColor: pressed ? color : color + "14",
                opacity: left ? 1 : 0.4,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              {({ pressed }) => (
                <>
                  <Check size={14} color={pressed ? "#fff" : color} strokeWidth={2.6} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: pressed ? "#fff" : color }}>Kıldım</Text>
                </>
              )}
            </Pressable>
          </Row>
        );
      })}
    </Card>
  );
}

/** Son 14 gün: günlük kılınan kaza */
function Week({ s }: { s: KazaState }) {
  const c = useColors();
  const max = Math.max(1, s.dailyGoal, ...s.week.map((d) => d.count));
  return (
    <Card style={{ gap: 10 }}>
      <Row>
        <Label>Son 14 gün</Label>
        <View style={{ flex: 1 }} />
        <Muted>{fmt(s.week.reduce((n, d) => n + d.count, 0))} kaza</Muted>
      </Row>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 70 }}>
        {s.week.map((d, i) => {
          const last = i === s.week.length - 1;
          return (
            <View key={d.dayKey} style={{ flex: 1, alignItems: "center", gap: 3 }}>
              {d.count > 0 && <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: last ? KAZA : c.mutedForeground }}>{d.count}</Text>}
              <View style={{ width: "100%", height: Math.max(3, (d.count / max) * 52), borderRadius: 4, backgroundColor: d.count ? (last ? KAZA : KAZA + "66") : c.muted }} />
            </View>
          );
        })}
      </View>
      <Row>
        <Muted style={{ fontSize: 10 }}>{s.week[0]?.dayKey.slice(5).split("-").reverse().join(".")}</Muted>
        <View style={{ flex: 1 }} />
        <Muted style={{ fontSize: 10 }}>bugün</Muted>
      </Row>
    </Card>
  );
}

/** Günlük hedef (bitiş tarihi buna göre hesaplanır) */
function Goal({ s, onChange }: { s: KazaState; onChange: (g: number) => void }) {
  const c = useColors();
  const opts = [0, 1, 2, 3, 6, 12];
  return (
    <Card style={{ gap: 10 }}>
      <Row gap={8}>
        <Target size={16} color={KAZA} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Günlük hedef</Text>
      </Row>
      <Row gap={6} style={{ flexWrap: "wrap" }}>
        {opts.map((g) => {
          const on = s.dailyGoal === g;
          return (
            <Pressable
              key={g}
              onPress={() => onChange(g)}
              style={({ pressed }) => ({ paddingHorizontal: 14, height: 34, justifyContent: "center", borderRadius: 10, borderWidth: 1.5, borderColor: on ? KAZA : c.border, backgroundColor: on ? KAZA : pressed ? c.muted : c.card })}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: on ? "#fff" : c.foreground }}>{g === 0 ? "Yok" : g === 6 ? "6 (1 gün)" : g === 12 ? "12 (2 gün)" : g}</Text>
            </Pressable>
          );
        })}
      </Row>
      <Muted>Her gün bir günlük kaza (6 vakit) kılan, kazasını gün sayısı kadar sürede bitirir.</Muted>
    </Card>
  );
}

/** Bildirim panelinde kaza kartı (uygulamayı açmadan "kıldım") */
function StickyToggle({ s }: { s: KazaState }) {
  const c = useColors();
  const [on, setOn] = useState(false);
  useEffect(() => {
    getKazaStickyPref().then(setOn);
  }, []);
  return (
    <Card>
      <Row gap={10}>
        <Bell size={18} color={KAZA} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Bildirim panelinde göster</Text>
          <Muted>Vakit butonlarıyla uygulamayı açmadan kaza işaretle</Muted>
        </View>
        <Switch
          value={on}
          onValueChange={async (v) => {
            setOn(v);
            await setKazaStickyPref(v);
            await syncKazaCard(s);
          }}
          trackColor={{ true: KAZA + "88", false: c.muted }}
          thumbColor={on ? KAZA : "#f4f4f5"}
        />
      </Row>
    </Card>
  );
}

/** Toplu kaza hesabı ya da elle giriş */
function CalcCard({ s, onApply }: { s: KazaState; onApply: (counts: Counts, mode: "replace" | "add") => void }) {
  const c = useColors();
  const empty = sum(s.remaining) + sum(s.made) === 0;
  const [open, setOpen] = useState(empty);
  const [tab, setTab] = useState<"calc" | "manual">("calc");
  return (
    <Card style={{ gap: 12 }}>
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Row gap={10}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: KAZA + "1f", alignItems: "center", justifyContent: "center" }}>
            <Calculator size={17} color={KAZA} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Kaza hesapla</Text>
            <Muted>Buluğdan bu yana kazanı toplu hesapla ya da elle gir</Muted>
          </View>
          {open ? <ChevronUp size={18} color={c.mutedForeground} /> : <ChevronDown size={18} color={c.mutedForeground} />}
        </Row>
      </Pressable>
      {open && (
        <>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "calc", label: "Hesapla" },
              { value: "manual", label: "Elle gir" },
            ]}
          />
          {tab === "calc" ? <Calc onApply={onApply} /> : <Manual s={s} onApply={onApply} />}
        </>
      )}
    </Card>
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
