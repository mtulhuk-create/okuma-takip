import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Badge, Body, Button, Card, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen, Title } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { minuteToTime } from "@/lib/format";
import { describePenalty, teamsActive, type GroupsResponse } from "@/lib/types";
import { TeamPicker } from "@/components/team-picker";

export default function GroupsScreen() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading, error, refetch, isRefetching } = useApi<GroupsResponse>(`/api/m/groups?q=${encodeURIComponent(query)}`);
  const action = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [teams, setTeams] = useState<Record<string, string>>({});

  if (isLoading && !data) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const myIds = new Set(data.mine.map((m) => m.group.id));
  const requested = new Set(data.requestedIds);
  const busy = (name: string, id: string) => action.isPending && action.variables?.name === name && action.variables.body?.groupId === id;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row style={{ justifyContent: "space-between" }}>
        <H1>Gruplar</H1>
        <Button title="Grup kur" icon={Plus} small onPress={() => router.push("/group/new")} />
      </Row>

      <Label>Gruplarım</Label>
      {data.mine.length === 0 && <Muted>Henüz bir gruba üye değilsin.</Muted>}
      {data.mine.map(({ group, role }) => (
        <Pressable key={group.id} onPress={() => router.push(`/group/${group.id}`)}>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Title numberOfLines={1}>
                  {group.name}
                </Title>
                <Muted>
                  {group._count.members} üye · son saat {minuteToTime(group.deadlineMinute)}
                </Muted>
              </View>
              {role === "ADMIN" && <Badge text="Yönetici" tone="primary" />}
            </Row>
          </Card>
        </Pressable>
      ))}

      <Label>Herkese açık gruplar</Label>
      <Row>
        <Input placeholder="Grup ara..." value={q} onChangeText={setQ} onSubmitEditing={() => setQuery(q.trim())} returnKeyType="search" />
        <Button title="Ara" variant="ghost" onPress={() => setQuery(q.trim())} />
      </Row>
      {data.publicGroups.length === 0 && <Muted>Grup bulunamadı.</Muted>}
      {data.publicGroups.map((g) => (
        <Card key={g.id}>
          <Pressable onPress={() => router.push(`/group/${g.id}`)}>
            <Title>{g.name}</Title>
            <Muted>
              {g._count.members} üye · günde {g.targetPages} sayfa · {describePenalty(g)}
              {teamsActive(g) ? ` · ${g.teams.length} ekip` : ""}
            </Muted>
          </Pressable>
          {g.description && <Body>{g.description}</Body>}
          {myIds.has(g.id) ? (
            <Badge text="Üyesin" tone="success" />
          ) : requested.has(g.id) ? (
            <Row>
              <Badge text="İstek gönderildi" tone="warning" />
              <Button title="Geri çek" small variant="ghost" loading={busy("cancelJoinRequest", g.id)} onPress={() => action.mutate({ name: "cancelJoinRequest", body: { groupId: g.id } })} />
            </Row>
          ) : (
            <View style={{ gap: 8 }}>
              {teamsActive(g) && <TeamPicker teams={g.teams} value={teams[g.id] ?? null} onChange={(t) => setTeams((s) => ({ ...s, [g.id]: t }))} />}
              <Input placeholder="Yöneticiye not (isteğe bağlı)" value={notes[g.id] ?? ""} onChangeText={(t) => setNotes((n) => ({ ...n, [g.id]: t }))} maxLength={300} />
              <Button
                title="Katılma isteği gönder"
                disabled={teamsActive(g) && !teams[g.id]}
                loading={busy("requestJoin", g.id)}
                onPress={() => action.mutate({ name: "requestJoin", body: { groupId: g.id, message: notes[g.id], teamId: teams[g.id] } })}
              />
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
