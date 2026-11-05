import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Body, Button, Card, ErrorView, H1, Label, Loading, Muted, Row, Screen, Title } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useColors } from "@/lib/theme";
import { describePenalty, teamsActive, type NotificationsResponse } from "@/lib/types";
import { TeamPicker } from "@/components/team-picker";
import { useState } from "react";

/** Web bağlantısını (/gruplar/x/yonetim) uygulama içi rotaya çevirir */
function toAppRoute(url: string | null) {
  if (!url) return null;
  const m = /^\/gruplar\/([^/]+)(\/yonetim)?/.exec(url);
  if (m) return m[2] ? `/group/${m[1]}/admin` : url.includes("/bilgi") ? `/group/${m[1]}/info` : `/group/${m[1]}`;
  if (url.startsWith("/gruplar")) return "/groups";
  if (url.startsWith("/bildirimler")) return null;
  return "/";
}

export default function NotificationsScreen() {
  const c = useColors();
  const { data, isLoading, error, refetch, isRefetching } = useApi<NotificationsResponse>("/api/m/notifications");
  const action = useAction();
  const [teams, setTeams] = useState<Record<string, string>>({});
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const unread = data.notes.some((n) => !n.read);
  const busy = (inviteId: string, accept: string) =>
    action.isPending && action.variables?.body?.inviteId === inviteId && action.variables.body?.accept === accept;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row style={{ justifyContent: "space-between" }}>
        <H1>Bildirimler</H1>
        {unread && <Button title="Tümünü okundu yap" small variant="ghost" onPress={() => action.mutate({ name: "markAllRead" })} />}
      </Row>

      {data.invites.length > 0 && <Label>Grup davetleri</Label>}
      {data.invites.map((inv) => (
        <Card key={inv.id} tone="accent">
          <Body>
            <Body style={{ fontFamily: "Poppins_700Bold" }}>{inv.inviter.name}</Body> seni <Body style={{ fontFamily: "Poppins_700Bold" }}>{inv.group.name}</Body> grubuna davet etti.
          </Body>
          <Muted>
            {inv.group._count.members} üye · günde {inv.group.targetPages} sayfa · {describePenalty(inv.group)}
          </Muted>
          {teamsActive(inv.group) && <TeamPicker teams={inv.group.teams} value={teams[inv.id] ?? null} onChange={(t) => setTeams((s) => ({ ...s, [inv.id]: t }))} />}
          <Row>
            <Button
              title="Katıl"
              variant="success"
              style={{ flex: 1 }}
              disabled={teamsActive(inv.group) && !teams[inv.id]}
              loading={busy(inv.id, "1")}
              onPress={() => action.mutate({ name: "respondInvite", body: { inviteId: inv.id, accept: "1", teamId: teams[inv.id] } })}
            />
            <Button title="Reddet" variant="ghost" style={{ flex: 1 }} loading={busy(inv.id, "0")} onPress={() => action.mutate({ name: "respondInvite", body: { inviteId: inv.id, accept: "0" } })} />
          </Row>
        </Card>
      ))}

      {data.notes.length === 0 && data.invites.length === 0 && <Muted style={{ textAlign: "center" }}>Henüz bildirim yok.</Muted>}
      {data.notes.map((n) => {
        const route = toAppRoute(n.url);
        return (
          <Pressable key={n.id} disabled={!route} onPress={() => route && router.push(route as never)}>
            <Card style={[!n.read && { borderLeftWidth: 4, borderLeftColor: c.primary }, n.read && { opacity: 0.7 }]}>
              <View style={{ gap: 2 }}>
                <Title style={{ fontSize: 14 }}>{n.title}</Title>
                <Body style={{ color: c.mutedForeground }}>{n.body}</Body>
                <Muted>{formatDateTime(n.createdAt)}</Muted>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
