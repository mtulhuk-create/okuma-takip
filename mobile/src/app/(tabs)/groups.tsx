import { router } from "expo-router";
import { AlarmClock, BookOpen, Check, ChevronRight, Clock, Coins, Crown, Globe, Lock, Plus, Search, Shield, UserRound, Users, Wallet } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Countdown } from "@/components/countdown";
import { TeamPicker } from "@/components/team-picker";
import { Badge, Body, Button, Card, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { minuteToTime } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import { booksOf, teamsActive, type GroupsResponse } from "@/lib/types";

function GroupIcon({ name }: { name: string }) {
  const c = useColors();
  return (
    <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: c.primaryForeground }}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

function Chip({ icon: Icon, text, tone }: { icon: typeof BookOpen; text: string; tone?: "danger" }) {
  const c = useColors();
  const color = tone === "danger" ? c.destructive : c.foreground;
  return (
    <Row gap={4} style={{ backgroundColor: tone === "danger" ? c.destructive + "1a" : c.muted, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Icon size={11} color={color} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color }}>{text}</Text>
    </Row>
  );
}

export default function GroupsScreen() {
  const c = useColors();
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
  const discover = data.publicGroups.filter((g) => !myIds.has(g.id));

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row style={{ justifyContent: "space-between" }}>
        <H1>Gruplar</H1>
        <Button title="Grup kur" icon={Plus} small onPress={() => router.push("/group/new")} />
      </Row>

      <Label>Gruplarım</Label>
      {data.mine.length === 0 && <Muted>Henüz bir gruba üye değilsin. Bir grup kur ya da aşağıdan katıl.</Muted>}
      {data.mine.map(({ group, role }) => {
        const t = data.today?.find((x) => x.groupId === group.id);
        const members = group._count.members;
        const done = !!t && t.myPages != null && t.myPages >= t.myTarget;
        const partial = !!t && t.myPages != null && !done;
        const statusBg = done ? c.success + "1a" : partial ? c.warning + "1a" : c.muted;
        return (
          <Pressable key={group.id} onPress={() => router.push(`/group/${group.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Card style={{ gap: 10, padding: 12 }}>
              <Row gap={12}>
                <GroupIcon name={group.name} />
                <View style={{ flex: 1 }}>
                  <Row gap={6}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, color: c.foreground }}>
                      {group.name}
                    </Text>
                    {role === "ADMIN" && <Crown size={14} color="#f59e0b" />}
                  </Row>
                  <Row gap={8}>
                    <Row gap={3}>
                      {group.visibility === "PUBLIC" ? <Globe size={11} color={c.mutedForeground} /> : <Lock size={11} color={c.mutedForeground} />}
                      <Muted>{members} üye</Muted>
                    </Row>
                    {t?.teamName && (
                      <Row gap={3}>
                        <Shield size={11} color={c.mutedForeground} />
                        <Muted>{t.teamName}</Muted>
                      </Row>
                    )}
                  </Row>
                </View>
                <ChevronRight size={18} color={c.mutedForeground} />
              </Row>

              {t ? (
                <>
                  <Row gap={8} style={{ backgroundColor: statusBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? c.success : partial ? "#f59e0b" : c.card, alignItems: "center", justifyContent: "center" }}>
                      {done ? <Check size={15} color="#fff" strokeWidth={3} /> : partial ? <BookOpen size={14} color="#fff" /> : <Clock size={14} color={c.mutedForeground} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.foreground }}>
                        {done ? "Bugünkü okuman tamam" : partial ? `Bugün ${t.myPages}/${t.myTarget} sayfa` : t.open ? "Bugün henüz bildirmedin" : "Okuma günü kapandı"}
                      </Text>
                      {t.open ? (
                        <Row gap={4}>
                          <Countdown to={t.deadline} style={{ fontSize: 11 }} />
                          <Muted style={{ fontSize: 11 }}>· {minuteToTime(group.deadlineMinute)}&apos;e kadar</Muted>
                        </Row>
                      ) : (
                        <Muted style={{ fontSize: 11 }}>Yeni gün {minuteToTime(group.startMinute)}&apos;de başlar</Muted>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>
                        {t.reported}/{members}
                      </Text>
                      <Muted style={{ fontSize: 10 }}>okudu</Muted>
                    </View>
                  </Row>
                  <Row gap={6} style={{ flexWrap: "wrap" }}>
                    <Chip icon={BookOpen} text={`günde ${t.myTarget} sf · alt ${t.myMin}`} />
                    <Chip icon={Coins} text={t.penalty} />
                    {t.debt > 0 && <Chip icon={Wallet} text={`borcun ${t.debt} TL`} tone="danger" />}
                  </Row>
                </>
              ) : (
                <Muted>Son bildirim {minuteToTime(group.deadlineMinute)}</Muted>
              )}
            </Card>
          </Pressable>
        );
      })}

      <Label>Keşfet</Label>
      <Row>
        <View style={{ flex: 1 }}>
          <Input placeholder="Herkese açık grup ara" value={q} onChangeText={setQ} onSubmitEditing={() => setQuery(q.trim())} returnKeyType="search" />
        </View>
        <Button title="" icon={Search} variant="ghost" onPress={() => setQuery(q.trim())} style={{ width: 46 }} />
      </Row>
      {discover.length === 0 && <Muted>Grup bulunamadı.</Muted>}
      {discover.map((g) => {
        const hasTeams = teamsActive(g);
        const books = booksOf(g);
        return (
          <Card key={g.id} style={{ gap: 10, padding: 12 }}>
            <Pressable onPress={() => router.push(`/group/${g.id}`)}>
              <Row gap={12} style={{ alignItems: "flex-start" }}>
                <GroupIcon name={g.name} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: c.foreground }}>
                    {g.name}
                  </Text>
                  <Row gap={8}>
                    <Row gap={3}>
                      <Users size={11} color={c.mutedForeground} />
                      <Muted>{g._count.members} üye</Muted>
                    </Row>
                    <Row gap={3}>
                      <UserRound size={11} color={c.mutedForeground} />
                      <Muted numberOfLines={1}>{g.owner.name}</Muted>
                    </Row>
                  </Row>
                  {g.description && (
                    <Body numberOfLines={2} style={{ fontSize: 13, color: c.mutedForeground, marginTop: 2 }}>
                      {g.description}
                    </Body>
                  )}
                </View>
              </Row>
            </Pressable>

            {hasTeams ? (
              // Ekip seçerken her ekibin günlük hedefi görünür
              requested.has(g.id) ? null : (
                <TeamPicker teams={g.teams} value={teams[g.id] ?? null} onChange={(t) => setTeams((s) => ({ ...s, [g.id]: t }))} label="Ekipler ve günlük hedefleri" />
              )
            ) : (
              <>
                <Row gap={6}>
                  {[
                    { Icon: BookOpen, big: `${g.targetPages} sf`, small: `günlük · alt ${g.minPages}` },
                    { Icon: Coins, big: `${g.penaltyAmount} TL`, small: g.penaltyMode === "PER_PAGE" ? "eksik sayfa başı" : g.minDiscount ? `alt sınırda %${g.minDiscount}` : "günlük ceza" },
                    { Icon: AlarmClock, big: minuteToTime(g.deadlineMinute), small: "son bildirim" },
                  ].map(({ Icon, big, small }) => (
                    <View key={small} style={{ flex: 1, alignItems: "center", backgroundColor: c.muted, borderRadius: 12, paddingVertical: 8 }}>
                      <Icon size={15} color={c.primary} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.foreground }}>{big}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: c.mutedForeground }}>{small}</Text>
                    </View>
                  ))}
                </Row>
                <Muted numberOfLines={1} style={{ fontSize: 11 }}>
                  📖 {books.map((b) => b.title).join(" · ")}
                </Muted>
              </>
            )}

            {requested.has(g.id) ? (
              <Row style={{ justifyContent: "space-between", backgroundColor: c.muted, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Badge text="İstek gönderildi" tone="warning" />
                <Button title="Geri çek" small variant="ghost" loading={busy("cancelJoinRequest", g.id)} onPress={() => action.mutate({ name: "cancelJoinRequest", body: { groupId: g.id } })} />
              </Row>
            ) : (
              <View style={{ gap: 8 }}>
                <Input placeholder="Yöneticiye not (isteğe bağlı)" value={notes[g.id] ?? ""} onChangeText={(t) => setNotes((n) => ({ ...n, [g.id]: t }))} maxLength={300} />
                <Button
                  title={hasTeams && !teams[g.id] ? "Önce ekibini seç" : "Katılma isteği gönder"}
                  disabled={hasTeams && !teams[g.id]}
                  loading={busy("requestJoin", g.id)}
                  onPress={() => action.mutate({ name: "requestJoin", body: { groupId: g.id, message: notes[g.id], teamId: teams[g.id] } })}
                />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
