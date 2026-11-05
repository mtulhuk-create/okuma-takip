import { Lock, Mail, Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useAction, useApi } from "@/lib/api";
import { useColors } from "@/lib/theme";
import { teamsActive, type GroupDetailResponse } from "@/lib/types";
import { GroupRules } from "./group-rules";
import { TeamPicker } from "./team-picker";
import { Body, Button, Card, ErrorView, H1, Input, Loading, Muted, Row, Screen, Title } from "./ui";

/** Üye olunmayan grup: kurallar + davet kabulü ya da katılma isteği (ekipliyse ekip seçimiyle) */
export function JoinView({ groupId }: { groupId: string }) {
  const c = useColors();
  const { data, isLoading, error, refetch } = useApi<GroupDetailResponse>(`/api/m/groups/${groupId}`);
  const action = useAction();
  const [note, setNote] = useState("");
  const [team, setTeam] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  if (data.private) {
    return (
      <Screen padTop={false}>
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <Lock size={36} color={c.mutedForeground} />
          <Title>Bu grup özel</Title>
          <Muted style={{ textAlign: "center" }}>Yalnızca yöneticinin davet ettiği kişiler katılabilir.</Muted>
        </Card>
      </Screen>
    );
  }
  const { group, invite, request } = data;
  const hasTeams = teamsActive(group);
  return (
    <Screen padTop={false}>
      <View>
        <H1>{group.name}</H1>
        <Row gap={6}>
          <Users size={14} color={c.mutedForeground} />
          <Muted>
            {group.members.length} üye · yönetici {group.owner.name}
          </Muted>
        </Row>
      </View>
      {group.description && <Body>{group.description}</Body>}
      {hasTeams ? (
        group.teams.map((t) => <GroupRules key={t.id} rules={t} startMinute={group.startMinute} deadlineMinute={group.deadlineMinute} title={`${t.name} ekibi`} />)
      ) : (
        <GroupRules rules={group} startMinute={group.startMinute} deadlineMinute={group.deadlineMinute} chatPolicy={group.chatPolicy} />
      )}
      <Card>
        {invite ? (
          <Row>
            <Mail size={18} color={c.primary} />
            <Body style={{ flex: 1 }}>{invite.inviter.name} seni bu gruba davet etti.</Body>
          </Row>
        ) : null}
        {request ? (
          <Body>Katılım isteğin yönetici onayı bekliyor.</Body>
        ) : (
          <>
            {hasTeams && <TeamPicker teams={group.teams} value={team} onChange={setTeam} label="Katılmak istediğin ekip" />}
            {!invite && <Input placeholder="Yöneticiye not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={300} />}
            <Row>
              <Button
                title={invite ? "Katıl" : "Katılma isteği gönder"}
                style={{ flex: 1 }}
                disabled={hasTeams && !team}
                loading={action.isPending}
                onPress={() =>
                  invite
                    ? action.mutate({ name: "respondInvite", body: { inviteId: invite.id, accept: "1", teamId: team } })
                    : action.mutate({ name: "requestJoin", body: { groupId, message: note, teamId: team } })
                }
              />
              {invite && <Button title="Reddet" variant="ghost" onPress={() => action.mutate({ name: "respondInvite", body: { inviteId: invite.id, accept: "0" } })} />}
            </Row>
          </>
        )}
      </Card>
    </Screen>
  );
}
