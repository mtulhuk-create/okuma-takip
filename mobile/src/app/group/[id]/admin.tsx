import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { GroupForm } from "@/components/group-form";
import { DateTimeField } from "@/components/pickers";
import { Avatar, Badge, Body, Button, Card, Divider, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen, Title, type Tone } from "@/components/ui";
import { UserSearch } from "@/components/user-search";
import { useAction, useApi } from "@/lib/api";
import { formatDateTime, formatDayKey, toLocalInput } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import type { AdminResponse, DueStatus } from "@/lib/types";

const DUE: Record<DueStatus, [string, Tone]> = {
  PENDING: ["Ödeme bekleniyor", "warning"],
  SUBMITTED: ["Onay bekliyor", "info"],
  CONFIRMED: ["Onaylandı", "success"],
  EXPIRED: ["Süresi doldu · atıldı", "danger"],
  CANCELLED: ["İptal", "neutral"],
};

function confirm(title: string, message: string, onOk: () => void, destructive = true) {
  Alert.alert(title, message, [
    { text: "Vazgeç", style: "cancel" },
    { text: "Evet", style: destructive ? "destructive" : "default", onPress: onOk },
  ]);
}

export default function AdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { data, isLoading, error, refetch, isRefetching } = useApi<AdminResponse>(`/api/m/groups/${id}/admin`);
  const action = useAction();
  const [dueDates, setDueDates] = useState<Record<string, Date>>({});
  const [deleteText, setDeleteText] = useState("");

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const { group, members, requests, invites, dues, unpaidPenalties, money } = data;
  const openDues = dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED");
  const pastDues = dues.filter((d) => d.status !== "PENDING" && d.status !== "SUBMITTED");
  const defaultDue = new Date(Date.now() + 3 * 86_400_000);
  const run = (name: string, body: Record<string, unknown>) => action.mutate({ name, body });
  const busyWith = (name: string, key: string, value: unknown) => action.isPending && action.variables?.name === name && action.variables.body?.[key] === value;

  return (
    <Screen padTop={false} refreshing={isRefetching} onRefresh={refetch}>
      <H1>{group.name}</H1>

      {requests.length > 0 && (
        <Card>
          <Title>🙋 Katılım istekleri ({requests.length})</Title>
          {requests.map((r) => (
            <Row key={r.id}>
              <Avatar name={r.user.name} uri={r.user.imageUrl} />
              <View style={{ flex: 1 }}>
                <Body numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
                  {r.user.name}
                </Body>
                {r.message && <Muted>“{r.message}”</Muted>}
              </View>
              <Button title="Kabul" small variant="success" loading={busyWith("respondJoinRequest", "requestId", r.id)} onPress={() => run("respondJoinRequest", { requestId: r.id, accept: "1" })} />
              <Button title="Red" small variant="ghost" onPress={() => run("respondJoinRequest", { requestId: r.id, accept: "0" })} />
            </Row>
          ))}
        </Card>
      )}

      {openDues.length > 0 && (
        <Card>
          <Title>💳 Açık ödemeler</Title>
          {openDues.map((d) => (
            <Card key={d.id} style={{ backgroundColor: c.muted }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Body style={{ fontFamily: fonts.semibold }}>
                  {d.user?.name} · {d.amount} TL
                </Body>
                <Badge text={DUE[d.status][0]} tone={DUE[d.status][1]} />
              </Row>
              <Muted>Vade: {formatDateTime(d.dueAt, group.tzOffset)}</Muted>
              {d.paymentNote && <Body>Not: “{d.paymentNote}”</Body>}
              <Row style={{ flexWrap: "wrap" }}>
                <Button title="✅ Ödemeyi onayla" small variant="success" loading={busyWith("resolvePayment", "dueId", d.id)} onPress={() => run("resolvePayment", { dueId: d.id, decision: "confirm" })} />
                {d.status === "SUBMITTED" && <Button title="Görmedim / reddet" small variant="ghost" onPress={() => run("resolvePayment", { dueId: d.id, decision: "reject" })} />}
                <Button title="Vadeyi iptal et" small variant="ghost" onPress={() => confirm("Vadeyi iptal et", "Cezalar tekrar ödenmemiş olarak işaretlenecek.", () => run("resolvePayment", { dueId: d.id, decision: "cancel" }))} />
              </Row>
            </Card>
          ))}
        </Card>
      )}

      <Card>
        <Title>👥 Üyeler ({members.length})</Title>
        {members.map((m, i) => {
          const mm = money[m.userId];
          const dueAt = dueDates[m.userId] ?? defaultDue;
          return (
            <View key={m.id} style={{ gap: 8 }}>
              {i > 0 && <Divider />}
              <Row>
                <Avatar name={m.user.name} uri={m.user.imageUrl} />
                <View style={{ flex: 1 }}>
                  <Row>
                    <Body numberOfLines={1} style={{ fontFamily: fonts.semibold, flexShrink: 1 }}>
                      {m.user.name}
                    </Body>
                    {m.role === "ADMIN" && <Badge text="Yönetici" tone="primary" />}
                  </Row>
                  <Muted>
                    {m.dailyPages} sf/gün
                    {mm?.unpaid ? ` · ${mm.unpaid} TL ödenmemiş` : ""}
                    {mm?.inDue ? ` · ${mm.inDue} TL vadede` : ""}
                  </Muted>
                </View>
              </Row>
              {mm?.unpaid ? (
                <Row style={{ alignItems: "flex-end" }}>
                  <DateTimeField label="Son ödeme tarihi" value={dueAt} onChange={(d) => setDueDates((s) => ({ ...s, [m.userId]: d }))} />
                  <Button
                    title={`🧾 ${mm.unpaid} TL vade ver`}
                    small
                    loading={busyWith("createDue", "userId", m.userId)}
                    onPress={() => run("createDue", { groupId: group.id, userId: m.userId, dueAt: toLocalInput(dueAt, group.tzOffset) })}
                  />
                </Row>
              ) : null}
              {m.userId !== group.ownerId && (
                <Row>
                  <Button title={m.role === "ADMIN" ? "Yöneticiliği al" : "Yönetici yap"} small variant="ghost" onPress={() => run("toggleAdmin", { memberId: m.id })} />
                  <Button
                    title="Çıkar"
                    small
                    variant="ghost"
                    textColor={c.destructive}
                    onPress={() => confirm("Üyeyi çıkar", `${m.user.name} gruptan çıkarılsın mı?`, () => run("removeMember", { memberId: m.id }))}
                  />
                </Row>
              )}
            </View>
          );
        })}
      </Card>

      <Card>
        <Title>📩 Davet et</Title>
        <UserSearch groupId={group.id} />
        {invites.length > 0 && (
          <View style={{ gap: 6 }}>
            <Label>Bekleyen davetler</Label>
            {invites.map((inv) => (
              <Row key={inv.id} style={{ justifyContent: "space-between" }}>
                <Body>{inv.invitee.name}</Body>
                <Button title="İptal" small variant="ghost" onPress={() => run("cancelInvite", { inviteId: inv.id })} />
              </Row>
            ))}
          </View>
        )}
      </Card>

      {unpaidPenalties.some((p) => p.status === "UNPAID") && (
        <Card>
          <Title>💸 Ödenmemiş cezalar</Title>
          {unpaidPenalties
            .filter((p) => p.status === "UNPAID")
            .map((p) => (
              <Row key={p.id} style={{ justifyContent: "space-between" }}>
                <Body numberOfLines={1} style={{ flex: 1 }}>
                  {p.user?.name} · {formatDayKey(p.dayKey)} · {p.pagesRead}/{p.requiredPages} sf
                </Body>
                <Body style={{ fontFamily: fonts.bold }}>{p.amount} TL</Body>
                <Button title="Affet" small variant="ghost" onPress={() => run("waivePenalty", { penaltyId: p.id })} />
              </Row>
            ))}
        </Card>
      )}

      <H1 style={{ fontSize: 20 }}>Ayarlar</H1>
      <GroupForm group={group} submitLabel="Ayarları kaydet" submitting={action.isPending && action.variables?.name === "updateGroup"} onSubmit={(body) => run("updateGroup", body)} />

      {pastDues.length > 0 && (
        <Card>
          <Title>📜 Ödeme geçmişi</Title>
          {pastDues.map((d) => (
            <Row key={d.id} style={{ justifyContent: "space-between" }}>
              <Body>
                {d.user?.name} · {d.amount} TL
              </Body>
              <Badge text={DUE[d.status][0]} tone={DUE[d.status][1]} />
            </Row>
          ))}
        </Card>
      )}

      <Card tone="danger">
        <Title style={{ color: c.destructive }}>Grubu sil</Title>
        <Muted>Yalnızca grubu kuran kişi silebilir. Onay için grup adını aynen yazın.</Muted>
        <Input placeholder={group.name} value={deleteText} onChangeText={setDeleteText} />
        <Button
          title="Grubu kalıcı olarak sil"
          variant="danger"
          disabled={deleteText !== group.name}
          onPress={() =>
            action.mutate({ name: "deleteGroup", body: { groupId: group.id, confirm: deleteText } }, { onSuccess: () => router.replace("/groups") })
          }
        />
      </Card>
    </Screen>
  );
}
