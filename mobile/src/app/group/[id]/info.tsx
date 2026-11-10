import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Copy, Crown, LogOut, Receipt, Shield, Wallet } from "lucide-react-native";
import { useState } from "react";
import { Alert, View } from "react-native";
import { BadgeChip } from "@/components/badge-chip";
import { StreakChip } from "@/components/history";
import { DueBadge } from "@/components/due-badge";
import { GroupRules } from "@/components/group-rules";
import { TeamPicker } from "@/components/team-picker";
import { Avatar, Badge, Body, Button, Card, Divider, ErrorView, Input, Label, Loading, Muted, Row, Screen, Title } from "@/components/ui";
import { toast, useAction, useApi } from "@/lib/api";
import { formatDayKey, formatIban } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import { teamsActive, type GroupDetailResponse } from "@/lib/types";

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { data, isLoading, error, refetch, isRefetching } = useApi<GroupDetailResponse>(`/api/m/groups/${id}`);
  const action = useAction();
  const [note, setNote] = useState("");
  const [team, setTeam] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (!data || data.private || !data.me || !data.board) return <ErrorView message={error?.message ?? "Bu grubun üyesi değilsin"} onRetry={refetch} />;
  const { group, me, myRules, teamChange, board } = data;
  const unpaid = board.penalties.filter((p) => p.status === "UNPAID" || p.status === "IN_DUE");
  const total = unpaid.reduce((s, p) => s + p.amount, 0);
  const openDues = board.dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED" || d.status === "OVERDUE");
  const myTeam = group.teams.find((t) => t.id === me.teamId);

  return (
    <Screen padTop={false} refreshing={isRefetching} onRefresh={refetch}>
      <Stack.Screen options={{ title: group.name }} />
      {group.description && <Body style={{ color: c.mutedForeground }}>{group.description}</Body>}

      {openDues.map((d) => (
        <Card key={d.id} tone="danger">
          <Row>
            <Receipt size={20} color={c.destructive} />
            <Title style={{ flex: 1 }}>{d.amount} TL ceza ödemesi</Title>
          </Row>
          <DueBadge due={d} />
          <Card style={{ gap: 4 }}>
            <Label>Grup kasası IBAN</Label>
            <Body style={{ fontFamily: fonts.semibold, letterSpacing: 0.5 }}>{formatIban(group.iban)}</Body>
            <Body>{group.ibanName}</Body>
            <Button
              title="IBAN'ı kopyala"
              icon={Copy}
              small
              variant="ghost"
              style={{ alignSelf: "flex-start" }}
              onPress={async () => {
                await Clipboard.setStringAsync(group.iban);
                toast("IBAN kopyalandı");
              }}
            />
          </Card>
          {d.status === "OVERDUE" ? (
            <Body style={{ color: c.destructive, fontFamily: fonts.semibold }}>
              Vaden doldu. Ödediysen yöneticiye haber ver; yönetici ek süre ya da indirim verebilir.
              {group.kickOnExpire !== false && d.decisionUntil ? " Karar süresi bitince gruptan çıkarılabilirsin." : ""}
            </Body>
          ) : d.status === "SUBMITTED" ? (
            <Body style={{ color: c.warning, fontFamily: fonts.semibold }}>Ödeme bildirdin, yönetici onayı bekleniyor.</Body>
          ) : (
            <>
              <Input placeholder="Not: gönderen ad, saat vb. (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={300} />
              <Button title="Ödedim" variant="success" loading={action.isPending} onPress={() => action.mutate({ name: "submitPayment", body: { dueId: d.id, note } })} />
              {group.kickOnExpire !== false && <Muted>Vade bitene kadar ödenmezse, yönetici ek süre vermezse gruptan çıkarılırsın.</Muted>}
            </>
          )}
        </Card>
      ))}

      {myRules && <GroupRules rules={myRules} startMinute={group.startMinute} deadlineMinute={group.deadlineMinute} chatPolicy={group.chatPolicy} title={myRules.teamName ? `${myRules.teamName} ekibinin kuralları` : undefined} />}

      {teamsActive(group) && (
        <Card>
          <Row>
            <Shield size={20} color={c.primary} />
            <Title style={{ flex: 1 }}>Ekibim</Title>
            <Badge text={myTeam?.name ?? "Seçilmedi"} tone="primary" />
          </Row>
          {teamChange ? (
            <Body>
              <Body style={{ fontFamily: fonts.bold }}>{teamChange.team.name}</Body> ekibine geçme isteğin yönetici onayı bekliyor.
            </Body>
          ) : (
            <>
              <TeamPicker teams={group.teams.filter((t) => t.id !== me.teamId)} value={team} onChange={setTeam} label={me.teamId ? "Geçmek istediğin ekip" : "Ekibini seç"} />
              <Button
                title={me.teamId && me.role !== "ADMIN" ? "Değişiklik isteği gönder" : "Ekibe geç"}
                variant="ghost"
                disabled={!team}
                loading={action.isPending}
                onPress={() => action.mutate({ name: "requestTeamChange", body: { groupId: id, teamId: team } }, { onSuccess: () => setTeam(null) })}
              />
              {me.teamId && me.role !== "ADMIN" && <Muted>Ekip değişikliği yönetici onayıyla gerçekleşir.</Muted>}
            </>
          )}
        </Card>
      )}

      <Card>
        <Row>
          <Wallet size={20} color={c.primary} />
          <Title style={{ flex: 1 }}>Cezalarım</Title>
          <Body style={{ fontFamily: fonts.bold, color: total ? c.destructive : c.success }}>{total ? `${total} TL` : "Yok"}</Body>
        </Row>
        {unpaid.slice(0, 10).map((p, i) => (
          <View key={p.id}>
            {i > 0 && <Divider />}
            <Row style={{ justifyContent: "space-between" }}>
              <Muted>
                {formatDayKey(p.dayKey)} · {p.pagesRead}/{p.requiredPages} sf
              </Muted>
              <Body style={{ fontFamily: fonts.bold }}>{p.amount} TL</Body>
            </Row>
          </View>
        ))}
      </Card>

      <Card>
        <Title>{group.members.length} üye</Title>
        {group.members.map((m) => (
          <Row key={m.id}>
            <Avatar name={m.user.name} uri={m.user.imageUrl} initial={m.user.initial} seed={m.user.id} size={34} frame={m.tier} />
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Body numberOfLines={1} style={{ flexShrink: 1 }}>
                {m.user.name}
                {m.userId === me.userId ? " (sen)" : ""}
              </Body>
              {m.badge && <BadgeChip tag={m.badge} />}
              <StreakChip s={m.streak} />
            </View>
            {teamsActive(group) && <Muted>{group.teams.find((t) => t.id === m.teamId)?.name ?? ""}</Muted>}
            {m.role === "ADMIN" && <Crown size={15} color={c.primary} />}
          </Row>
        ))}
      </Card>

      <Button
        title="Gruptan ayrıl"
        icon={LogOut}
        variant="ghost"
        textColor={c.destructive}
        onPress={() =>
          Alert.alert("Gruptan ayrıl", "Gruptan ayrılmak istediğine emin misin?", [
            { text: "Vazgeç", style: "cancel" },
            { text: "Ayrıl", style: "destructive", onPress: () => action.mutate({ name: "leaveGroup", body: { groupId: id } }, { onSuccess: () => router.replace("/groups") }) },
          ])
        }
      />
    </Screen>
  );
}
