import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Countdown } from "@/components/countdown";
import { ReportButtons } from "@/components/report-buttons";
import { Avatar, Badge, Body, Button, Card, Divider, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen, Title, type Tone } from "@/components/ui";
import { toast, useAction, useApi } from "@/lib/api";
import { formatDateTime, formatDayKey, formatIban, minuteToTime } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { Group, GroupDetailResponse, PenaltyStatus } from "@/lib/types";

const PENALTY: Record<PenaltyStatus, [string, Tone]> = {
  UNPAID: ["Ödenmedi", "danger"],
  IN_DUE: ["Vadede", "warning"],
  PAID: ["Ödendi", "success"],
  WAIVED: ["Affedildi", "neutral"],
};

function Rules({ group }: { group: Group }) {
  const items = [
    ["Alt sınır", `${group.minPages} sayfa/gün`],
    ["Ceza", group.penaltyMode === "FIXED" ? `${group.penaltyAmount} TL / gün` : `${group.penaltyAmount} TL / eksik sayfa`],
    ["Okuma günü", `${minuteToTime(group.startMinute)} → ${minuteToTime(group.deadlineMinute)}`],
    ["Uyarı", `${group.reminderHours ? `${group.reminderHours} saat önce` : "Kapalı"} + son 10 dk`],
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {items.map(([l, v]) => (
        <Card key={l} style={{ width: "48%", padding: 12, gap: 2 }}>
          <Label>{l}</Label>
          <Body style={{ fontFamily: fonts.semibold }}>{v}</Body>
        </Card>
      ))}
    </View>
  );
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { data, isLoading, error, refetch, isRefetching } = useApi<GroupDetailResponse>(`/api/m/groups/${id}`);
  const action = useAction();
  const [joinNote, setJoinNote] = useState("");
  const [payNote, setPayNote] = useState("");
  const [target, setTarget] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;

  if (data.private) {
    return (
      <Screen padTop={false}>
        <Stack.Screen options={{ title: data.group.name }} />
        <Card style={{ alignItems: "center" }}>
          <Body style={{ fontSize: 44 }}>🔒</Body>
          <Title>Bu grup özel</Title>
          <Muted style={{ textAlign: "center" }}>Yalnızca yöneticinin davet ettiği kişiler katılabilir.</Muted>
        </Card>
      </Screen>
    );
  }

  const { group, me, invite, request, board } = data;
  const busy = (name: string) => action.isPending && action.variables?.name === name;

  // ---- Üye olmayan görünüm ----
  if (!me || !board) {
    return (
      <Screen padTop={false} refreshing={isRefetching} onRefresh={refetch}>
        <Stack.Screen options={{ title: "" }} />
        <H1>{group.name}</H1>
        <Muted>
          {group.members.length} üye · yönetici {group.owner.name}
        </Muted>
        {group.description && <Body>{group.description}</Body>}
        <Rules group={group} />
        {invite ? (
          <Card tone="accent">
            <Body>
              📩 <Body style={{ fontFamily: fonts.bold }}>{invite.inviter.name}</Body> seni bu gruba davet etti.
            </Body>
            <Row>
              <Button title="Katıl" variant="success" style={{ flex: 1 }} loading={busy("respondInvite")} onPress={() => action.mutate({ name: "respondInvite", body: { inviteId: invite.id, accept: "1" } })} />
              <Button title="Reddet" variant="ghost" style={{ flex: 1 }} onPress={() => action.mutate({ name: "respondInvite", body: { inviteId: invite.id, accept: "0" } })} />
            </Row>
          </Card>
        ) : request ? (
          <Card>
            <Body>⏳ Katılım isteğin yönetici onayı bekliyor.</Body>
          </Card>
        ) : (
          <Card>
            <Input placeholder="Yöneticiye not (isteğe bağlı)" value={joinNote} onChangeText={setJoinNote} maxLength={300} />
            <Button title="Katılma isteği gönder" loading={busy("requestJoin")} onPress={() => action.mutate({ name: "requestJoin", body: { groupId: group.id, message: joinNote } })} />
          </Card>
        )}
      </Screen>
    );
  }

  // ---- Üye görünümü ----
  const { period, open, days, dayStarts, logs, penalties, dues } = board;
  const logMap = new Map(logs.map((l) => [`${l.userId}:${l.dayKey}`, l]));
  const myToday = logMap.get(`${me.userId}:${period.dayKey}`);
  const unpaidTotal = penalties.filter((p) => p.status === "UNPAID" || p.status === "IN_DUE").reduce((s, p) => s + p.amount, 0);
  const openDues = dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED");

  return (
    <Screen padTop={false} refreshing={isRefetching} onRefresh={refetch}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: me.role === "ADMIN" ? () => <Button title="⚙️ Yönetim" small variant="ghost" onPress={() => router.push(`/group/${id}/admin`)} /> : undefined,
        }}
      />
      <View>
        <H1>{group.name}</H1>
        <Muted>
          {group.visibility === "PUBLIC" ? "🌍 Herkese açık" : "🔒 Özel"} · {group.members.length} üye
        </Muted>
      </View>
      {group.description && <Body>{group.description}</Body>}

      {openDues.map((d) => (
        <Card key={d.id} tone="danger">
          <Title style={{ color: c.destructive }}>🧾 Ödenecek ceza: {d.amount} TL</Title>
          <Body>
            Son ödeme: <Body style={{ fontFamily: fonts.bold }}>{formatDateTime(d.dueAt, group.tzOffset)}</Body>. Bu tarihe kadar ödemen yönetici tarafından onaylanmazsa gruptan otomatik çıkarılırsın.
          </Body>
          <Countdown to={d.dueAt} />
          <Card style={{ gap: 4 }}>
            <Label>IBAN</Label>
            <Body style={{ fontFamily: fonts.semibold, letterSpacing: 0.5 }}>{formatIban(group.iban)}</Body>
            <Body>{group.ibanName}</Body>
            <Muted>Açıklama: {me.user.name} — Okuma Takip cezası</Muted>
            <Button
              title="IBAN'ı kopyala"
              small
              variant="ghost"
              onPress={async () => {
                await Clipboard.setStringAsync(group.iban);
                toast("IBAN kopyalandı");
              }}
            />
          </Card>
          {d.status === "SUBMITTED" ? (
            <Body style={{ color: c.warning, fontFamily: fonts.semibold }}>⏳ Ödeme bildirdin, yönetici onayı bekleniyor.</Body>
          ) : (
            <>
              <Input placeholder="Not: gönderen ad, saat, banka vb." value={payNote} onChangeText={setPayNote} maxLength={300} />
              <Button title="💳 Ödedim" variant="success" loading={busy("submitPayment")} onPress={() => action.mutate({ name: "submitPayment", body: { dueId: d.id, note: payNote } })} />
            </>
          )}
        </Card>
      ))}

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Title>📖 {formatDayKey(period.dayKey)}</Title>
          {open && <Countdown to={open.deadline} />}
        </Row>
        {open ? (
          <ReportButtons groupId={group.id} dailyPages={me.dailyPages} current={myToday?.pages ?? null} />
        ) : (
          <Muted>
            Bildirim süresi doldu. Yeni gün {minuteToTime(group.startMinute)}&apos;de başlıyor.
          </Muted>
        )}
      </Card>

      <Card>
        <Title>👥 Son 7 gün</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ gap: 6 }}>
            <Row gap={0}>
              <View style={{ width: 130 }} />
              {days.map((d) => (
                <Muted key={d} style={{ width: 34, textAlign: "center", fontFamily: fonts.semibold }}>
                  {Number(d.slice(8))}
                </Muted>
              ))}
            </Row>
            {group.members.map((m) => (
              <Row key={m.id} gap={0}>
                <Row style={{ width: 130 }}>
                  <Avatar name={m.user.name} uri={m.user.imageUrl} size={26} />
                  <View style={{ flex: 1 }}>
                    <Body numberOfLines={1} style={{ fontSize: 12, fontFamily: fonts.medium }}>
                      {m.user.name}
                      {m.role === "ADMIN" ? " ⭐" : ""}
                    </Body>
                    <Muted style={{ fontSize: 10 }}>{m.dailyPages} sf/gün</Muted>
                  </View>
                </Row>
                {days.map((d) => {
                  const l = logMap.get(`${m.userId}:${d}`);
                  const isToday = d === period.dayKey;
                  const closed = !(isToday && open);
                  const eligible = new Date(m.joinedAt) <= new Date(dayStarts[d]);
                  let text = "·";
                  let color = c.mutedForeground;
                  if (l) {
                    text = String(l.pages);
                    color = l.pages >= l.requiredPages ? c.success : c.destructive;
                  } else if (closed && eligible) {
                    text = "✗";
                    color = c.destructive;
                  } else if (isToday && open) text = "…";
                  return (
                    <Body key={d} style={{ width: 34, textAlign: "center", color, fontFamily: fonts.bold, fontSize: 12, backgroundColor: isToday ? c.accent : undefined, borderRadius: 4 }}>
                      {text}
                    </Body>
                  );
                })}
              </Row>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Rules group={group} />

      <Card>
        <Title>🎯 Günlük hedefim</Title>
        <Row>
          <Input value={target ?? String(me.dailyPages)} onChangeText={setTarget} keyboardType="number-pad" />
          <Button title="Kaydet" loading={busy("setDailyPages")} onPress={() => action.mutate({ name: "setDailyPages", body: { groupId: group.id, dailyPages: target ?? me.dailyPages } })} />
        </Row>
        <Muted>Bu sayının altında kalırsan ceza yazılır. En az {group.minPages} olabilir.</Muted>
      </Card>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Title>💸 Cezalarım</Title>
          <Body style={{ fontFamily: fonts.bold, color: unpaidTotal ? c.destructive : c.success }}>{unpaidTotal} TL ödenmemiş</Body>
        </Row>
        {penalties.length === 0 && <Muted>Hiç cezan yok, böyle devam! 🎉</Muted>}
        {penalties.map((p, i) => (
          <View key={p.id}>
            {i > 0 && <Divider />}
            <Row style={{ justifyContent: "space-between" }}>
              <Body>
                {formatDayKey(p.dayKey)} · {p.pagesRead}/{p.requiredPages} sf
              </Body>
              <Row>
                <Body style={{ fontFamily: fonts.bold }}>{p.amount} TL</Body>
                <Badge text={PENALTY[p.status][0]} tone={PENALTY[p.status][1]} />
              </Row>
            </Row>
          </View>
        ))}
      </Card>

      <Button
        title="Gruptan ayrıl"
        variant="ghost"
        textColor={c.destructive}
        onPress={() =>
          Alert.alert("Gruptan ayrıl", "Gruptan ayrılmak istediğine emin misin?", [
            { text: "Vazgeç", style: "cancel" },
            { text: "Ayrıl", style: "destructive", onPress: () => action.mutate({ name: "leaveGroup", body: { groupId: group.id } }, { onSuccess: () => router.back() }) },
          ])
        }
      />
    </Screen>
  );
}
