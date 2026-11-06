import { BookSuggestProvider, useBookSuggest } from "./book-match";
import { AlarmClock, AtSign, BookOpen, ChevronDown, Globe, Landmark, Lock, PencilLine, Plus, ShieldCheck, Trash2, UserRound, Users, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { fonts, useColors } from "@/lib/theme";
import { booksOf, type Group, type Rules } from "@/lib/types";
import { TimeField } from "./pickers";
import { RulesEditor } from "./rules-editor";
import { Button, Card, Input, Muted, Row, Segmented } from "./ui";

export type GroupFormValues = Record<string, string | number>;
type TeamDraft = Rules & { id?: string; name: string; key: string };
const DEFAULT_RULES: Rules = { penaltyMode: "FIXED", targetPages: 20, minPages: 10, penaltyAmount: 20, minDiscount: 50, books: [{ id: "kitap1", title: "Risale-i Nur Külliyatı", targetPages: 20, minPages: 10 }] };
const pick = (r: Omit<Rules, "books"> & { books?: unknown }): Rules => {
  const books = booksOf(r);
  return { penaltyMode: r.penaltyMode, targetPages: books.reduce((s, b) => s + b.targetPages, 0), minPages: books.reduce((s, b) => s + b.minPages, 0), penaltyAmount: r.penaltyAmount, minDiscount: r.minDiscount, books };
};

/** Ayar bölümü: başlıkta güncel ayarın özeti; düzenlemede kapalı başlar, dokununca açılır */
function Section({ icon: Icon, title, hint, summary, collapsible, children }: { icon: LucideIcon; title: string; hint?: string; summary?: string; collapsible?: boolean; children: React.ReactNode }) {
  const c = useColors();
  const [open, setOpen] = useState(!collapsible);
  return (
    <Card style={{ gap: 0, padding: 0, overflow: "hidden" }}>
      <Pressable onPress={() => collapsible && setOpen((o) => !o)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: pressed && collapsible ? c.muted : "transparent" })}>
        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center" }}>
          <Icon size={19} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.foreground }}>{title}</Text>
          {open ? hint ? <Muted>{hint}</Muted> : null : summary ? <Muted numberOfLines={1}>{summary}</Muted> : null}
        </View>
        {collapsible && <ChevronDown size={20} color={c.mutedForeground} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />}
      </Pressable>
      {open && <View style={{ gap: 14, padding: 14, borderTopWidth: 1, borderTopColor: c.border }}>{children}</View>}
    </Card>
  );
}

function TeamCard({ team, index, canRemove, onChange, onRemove }: { team: TeamDraft; index: number; canRemove: boolean; onChange: (t: TeamDraft) => void; onRemove: () => void }) {
  const c = useColors();
  const [open, setOpen] = useState(index === 0);
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, gap: 10 }}>
      <Row>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.bold, color: c.primary }}>{index + 1}</Text>
        </View>
        <Input value={team.name} onChangeText={(name) => onChange({ ...team, name })} placeholder={`${index + 1}. ekip adı`} maxLength={40} />
        <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8}>
          <ChevronDown size={20} color={c.mutedForeground} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
        </Pressable>
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Trash2 size={18} color={c.mutedForeground} />
          </Pressable>
        )}
      </Row>
      {open ? (
        <RulesEditor value={team} onChange={(r) => onChange({ ...team, ...r })} />
      ) : (
        <Muted>
          {team.books.length} eser · günde {team.targetPages} sayfa · alt sınır {team.minPages} · {team.penaltyMode === "FIXED" ? `${team.penaltyAmount} TL (%${team.minDiscount} indirim)` : `${team.penaltyAmount} TL/eksik sayfa`}
        </Muted>
      )}
    </View>
  );
}

export function GroupForm({ group, onSubmit, submitting, submitLabel }: { group?: Group; onSubmit: (v: GroupFormValues) => void; submitting?: boolean; submitLabel: string }) {
  const c = useColors();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">(group?.visibility ?? "PRIVATE");
  const [chatPolicy, setChatPolicy] = useState<"ALL" | "ADMINS">(group?.chatPolicy ?? "ALL");
  const [shareProgress, setShareProgress] = useState(group?.shareProgress ?? false);
  const [rules, setRules] = useState<Rules>(group ? pick(group) : DEFAULT_RULES);
  const [teamsEnabled, setTeamsEnabled] = useState(group?.teamsEnabled ?? false);
  const [teams, setTeams] = useState<TeamDraft[]>(group?.teams?.map((t) => ({ ...pick(t), id: t.id, name: t.name, key: t.id })) ?? []);
  const [startMinute, setStartMinute] = useState(group?.startMinute ?? 0);
  const [deadlineMinute, setDeadlineMinute] = useState(group?.deadlineMinute ?? 1439);
  const [reminderHours, setReminderHours] = useState(group?.reminderHours ?? 2);
  const [iban, setIban] = useState(group?.iban ?? "");
  const [ibanName, setIbanName] = useState(group?.ibanName ?? "");
  const [dueOffset, setDueOffset] = useState(group?.dueOffsetDays ?? 0);
  const suggest = useBookSuggest(!group);
  const [kickOnExpire, setKickOnExpire] = useState(group?.kickOnExpire ?? true);
  const [nameDisplay, setNameDisplay] = useState<"ENTERED" | "ACCOUNT" | "BOTH">(group?.nameDisplay ?? "ENTERED");
  const edit = !!group;
  // Kaydedilmemiş değişiklik göstergesi
  const snapshot = JSON.stringify([name, description, visibility, chatPolicy, shareProgress, rules, teamsEnabled, teams, startMinute, deadlineMinute, reminderHours, iban, ibanName, dueOffset, kickOnExpire, nameDisplay]);
  const [saved, setSaved] = useState(snapshot);
  const dirty = snapshot !== saved;
  const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const newTeam = (n: number): TeamDraft => ({ ...rules, books: rules.books.map((b) => ({ ...b, id: `${b.id}-${n}` })), name: `${String.fromCharCode(65 + n)} Ekibi`, key: `new-${Date.now()}-${n}` });

  function toggleTeams(on: boolean) {
    setTeamsEnabled(on);
    if (on && teams.length < 2) setTeams((t) => [...t, ...Array.from({ length: 2 - t.length }, (_, i) => newTeam(t.length + i))]);
  }

  return (
    <BookSuggestProvider value={suggest}>
    <View style={{ gap: 14 }}>
      <Section icon={PencilLine} title="Genel" summary={`${name || "Adsız grup"} · ${visibility === "PUBLIC" ? "Herkese açık" : "Özel"}`} collapsible={edit}>
        <Input label="Grup adı" value={name} onChangeText={setName} placeholder="Örn. Sabah Okurları" maxLength={80} />
        <Input label="Açıklama (isteğe bağlı)" value={description} onChangeText={setDescription} multiline maxLength={500} />
        <View>
          <Muted style={{ marginBottom: 6 }}>Kimler katılabilir?</Muted>
          <Segmented
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "PRIVATE", label: "Özel", hint: "Yalnızca davetle", icon: Lock },
              { value: "PUBLIC", label: "Herkese açık", hint: "Listede görünür", icon: Globe },
            ]}
          />
        </View>
      </Section>

      <Section
        icon={BookOpen}
        title="Okuma ve ceza kuralları"
        hint="Eserleri, günlük hedefi ve cezayı belirle. İstersen grubu ekiplere ayır."
        summary={teamsEnabled ? `${teams.length} ekip · her ekibin kendi kuralı` : `${rules.books.map((x) => x.title).join(", ")} · günde ${rules.targetPages} sf · ${rules.penaltyMode === "FIXED" ? `${rules.penaltyAmount} TL/gün` : `${rules.penaltyAmount} TL/sayfa`}`}
        collapsible={edit}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Grubu ekiplere böl</Text>
            <Muted>Katılanlar ekibini seçer; değişiklik yönetici onayıyla olur.</Muted>
          </View>
          <Switch value={teamsEnabled} onValueChange={toggleTeams} trackColor={{ true: c.primary, false: c.muted }} thumbColor="#fff" />
        </Row>
        {teamsEnabled && (
          <View style={{ gap: 8 }}>
            {teams.map((t, i) => (
              <TeamCard
                key={t.key}
                team={t}
                index={i}
                canRemove={teams.length > 2}
                onChange={(nt) => setTeams((all) => all.map((x) => (x.key === t.key ? nt : x)))}
                onRemove={() => setTeams((all) => all.filter((x) => x.key !== t.key))}
              />
            ))}
            <Button title="Ekip ekle" icon={Plus} small variant="ghost" onPress={() => setTeams((all) => [...all, newTeam(all.length)])} style={{ alignSelf: "flex-start" }} />
          </View>
        )}
        {!teamsEnabled && <RulesEditor value={rules} onChange={setRules} />}
      </Section>

      <Section
        icon={AlarmClock}
        title="Zamanlama"
        hint="Türkiye saati"
        summary={`${time(startMinute)} – ${deadlineMinute <= startMinute ? "ertesi gün " : ""}${time(deadlineMinute)}${reminderHours ? ` · ${reminderHours} sa önce uyarı` : " · uyarı kapalı"}`}
        collapsible={edit}
      >
        <Row>
          <TimeField label="Gün başlar" minute={startMinute} onChange={setStartMinute} />
          <TimeField label={deadlineMinute <= startMinute ? "Son bildirim (ertesi gün)" : "Son bildirim"} minute={deadlineMinute} onChange={setDeadlineMinute} />
        </Row>
        <View>
          <Muted style={{ marginBottom: 6 }}>Son saatten önce uyarı</Muted>
          <Row style={{ flexWrap: "wrap" }} gap={6}>
            {[0, 1, 2, 3, 6, 12].map((h) => (
              <Pressable key={h} onPress={() => setReminderHours(h)} style={{ borderRadius: 99, borderWidth: 1, borderColor: h === reminderHours ? c.primary : c.border, backgroundColor: h === reminderHours ? c.primary : c.card, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: h === reminderHours ? c.primaryForeground : c.foreground }}>{h === 0 ? "Kapalı" : `${h} saat`}</Text>
              </Pressable>
            ))}
          </Row>
        </View>
        <Muted>
          Her gün {time(startMinute)}&apos;de başlar, {deadlineMinute <= startMinute ? "ertesi gün " : ""}
          {time(deadlineMinute)}&apos;de kapanır.{reminderHours ? ` ${reminderHours} saat önce uyarı,` : ""} son 10 dakikada geri sayım gelir.
        </Muted>
      </Section>

      <Section
        icon={ShieldCheck}
        title="Sohbet ve üyeler"
        summary={`${chatPolicy === "ALL" ? "Herkes yazar" : "Yalnızca yöneticiler yazar"} · ${{ ENTERED: "Yazdığı ad", ACCOUNT: "Hesap adı", BOTH: "Ad + hesap adı" }[nameDisplay]} · geçmiş ${shareProgress ? "açık" : "gizli"}`}
        collapsible={edit}
      >
        <View>
          <Muted style={{ marginBottom: 6 }}>Kimler yazabilir?</Muted>
          <Segmented
            value={chatPolicy}
            onChange={setChatPolicy}
            options={[
              { value: "ALL", label: "Tüm üyeler", hint: "Mesaj ve anket", icon: Users },
              { value: "ADMINS", label: "Yöneticiler", hint: "Üyeler okur", icon: ShieldCheck },
            ]}
          />
        </View>
        <View>
          <Muted style={{ marginBottom: 6 }}>Okuyucuların adı nasıl görünsün?</Muted>
          <Segmented
            value={nameDisplay}
            onChange={setNameDisplay}
            options={[
              { value: "ENTERED", label: "Yazdığı ad", hint: "Pencerede", icon: UserRound },
              { value: "ACCOUNT", label: "Hesap adı", hint: "Google / e-posta", icon: AtSign },
              { value: "BOTH", label: "İkisi", hint: "Ahmet Sinan", icon: Users },
            ]}
          />
        </View>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Okuyucular birbirinin geçmişini görsün</Text>
            <Muted>Kapalıyken üyeler geçmiş tablosunda yalnızca kendilerini görür.</Muted>
          </View>
          <Switch value={shareProgress} onValueChange={setShareProgress} trackColor={{ true: c.primary, false: c.muted }} thumbColor="#fff" />
        </Row>
      </Section>

      <Section
        icon={Landmark}
        title="Kasa ve ödemeler"
        hint="Cezalar grubun kasasında toplanır; yönetici de herkes gibi okur ve ceza öder. Yalnızca üyeler görür."
        summary={`${iban ? "IBAN girildi" : "IBAN yok"} · ${dueOffset === 0 ? "ay sonu" : dueOffset < 0 ? `ay sonundan ${-dueOffset} gün önce` : `ay sonundan ${dueOffset} gün sonra`} · ${kickOnExpire ? "ödemeyen çıkarılır" : "ödemeyen çıkarılmaz"}`}
        collapsible={edit}
      >
        <Input label="Grup kasası IBAN" value={iban.replace(/(.{4})/g, "$1 ").trim()} onChangeText={(v) => setIban(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 26))} autoCapitalize="characters" placeholder="TR00 0000 0000 0000 0000 0000 00" />
        <Input label="Hesap sahibi adı soyadı" value={ibanName} onChangeText={setIbanName} />
        <View>
          <Muted style={{ marginBottom: 6 }}>Varsayılan ödeme vadesi</Muted>
          <Row gap={8}>
            <Button title="−" variant="ghost" onPress={() => setDueOffset((d) => Math.max(-25, d - 1))} style={{ width: 46 }} />
            <View style={{ flex: 1, alignItems: "center", borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 6, backgroundColor: c.card }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>
                {dueOffset === 0 ? "Her ayın son günü" : dueOffset < 0 ? `Ay sonundan ${-dueOffset} gün önce` : `Ay sonundan ${dueOffset} gün sonra`}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Vade verirken bu tarih önerilir</Text>
            </View>
            <Button title="+" variant="ghost" onPress={() => setDueOffset((d) => Math.min(25, d + 1))} style={{ width: 46 }} />
          </Row>
        </View>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.foreground }}>Vadesinde ödemeyen gruptan çıkarılsın</Text>
            <Muted>Vade dolunca önce sana sorulur: ek süre ver, indirim yap ya da çıkar. 24 saat içinde karar vermezsen çıkarılır. Kapalıysa borç açık kalır.</Muted>
          </View>
          <Switch value={kickOnExpire} onValueChange={setKickOnExpire} trackColor={{ true: c.primary, false: c.muted }} thumbColor="#fff" />
        </Row>
      </Section>

      {edit && <Text style={{ textAlign: "center", fontFamily: dirty ? fonts.semibold : fonts.regular, fontSize: 12, color: dirty ? c.warning : c.mutedForeground }}>{dirty ? "Kaydedilmemiş değişiklikler var" : "Tüm değişiklikler kaydedildi"}</Text>}
      <Button
        title={submitLabel}
        loading={submitting}
        disabled={edit && !dirty}
        onPress={() => {
          setSaved(snapshot);
          onSubmit({
            ...(group ? { groupId: group.id } : {}),
            name,
            description,
            visibility,
            chatPolicy,
            shareProgress: shareProgress ? "1" : "0",
            ...rules,
            books: JSON.stringify(rules.books),
            teamsEnabled: teamsEnabled ? "1" : "0",
            teams: JSON.stringify(teams.map(({ key: _k, ...t }) => t)),
            startTime: time(startMinute),
            deadlineTime: time(deadlineMinute),
            reminderHours,
            iban,
            ibanName,
            dueOffsetDays: dueOffset,
            kickOnExpire: kickOnExpire ? "1" : "0",
            nameDisplay,
            ...(group ? {} : { bookLinks: suggest.linksJson() }),
          });
        }}
      />
    </View>
    </BookSuggestProvider>
  );
}
