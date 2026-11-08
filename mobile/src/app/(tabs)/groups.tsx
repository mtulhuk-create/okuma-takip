import { useBookCheck } from "@/components/book-match";
import { router } from "expo-router";
import { AlarmClock, BookOpen, Check, ChevronRight, Clock, Coins, Crown, Globe, Lock, Plus, Search, UserRound, Users, Wallet } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Countdown } from "@/components/countdown";
import { DueBadge } from "@/components/due-badge";
import { TeamPicker } from "@/components/team-picker";
import { Badge, Body, Button, Card, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { LITE } from "@/lib/variant";
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

const COVERS = ["#9b2c2c", "#2f6f4f", "#1e4e79", "#8a5a1f", "#5b3a8a", "#0f766e", "#7c2d4a"];
function coverColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

/** Okuma grubunu temsil eden küçük kitap kapağı */
function BookCover({ name, color }: { name: string; color: string }) {
  return (
    <View style={{ width: 36, height: 48, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderTopRightRadius: 7, borderBottomRightRadius: 7, backgroundColor: color, alignItems: "center", justifyContent: "center", overflow: "hidden", elevation: 2 }}>
      <View style={{ position: "absolute", left: 4, top: 0, bottom: 0, width: 1, backgroundColor: "#ffffff59" }} />
      <View style={{ position: "absolute", left: 8, right: 6, top: 6, height: 1, backgroundColor: "#ffffff66" }} />
      <View style={{ position: "absolute", left: 8, right: 6, bottom: 6, height: 1, backgroundColor: "#ffffff66" }} />
      <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: "#fff" }}>{name[0]?.toUpperCase()}</Text>
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
  const bookCheck = useBookCheck();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [teams, setTeams] = useState<Record<string, string>>({});

  if (isLoading && !data) return <Loading />;
  if (!data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const myIds = new Set(data.mine.map((m) => m.group.id));
  const requested = new Set(data.requestedIds);
  const busy = (name: string, id: string) => action.isPending && action.variables?.name === name && action.variables.body?.groupId === id;
  const discover = data.publicGroups.filter((g) => !myIds.has(g.id));

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row style={{ justifyContent: "space-between" }}>
        <H1>Gruplar</H1>
        {!LITE && <Button title="Grup kur" icon={Plus} small onPress={() => router.push("/group/new")} />}
      </Row>

      <Label>Gruplarım</Label>
      {data.mine.length === 0 && <Muted>{LITE ? "Henüz bir gruba üye değilsin. Aşağıdan bir gruba katıl." : "Henüz bir gruba üye değilsin. Bir grup kur ya da aşağıdan katıl."}</Muted>}
      {data.mine.map(({ group, role }) => {
        const t = data.today?.find((x) => x.groupId === group.id);
        const members = group._count.members;
        const done = !!t && t.myPages != null && t.myPages >= t.myTarget;
        const partial = !!t && t.myPages != null && !done;
        const cover = coverColor(group.id);
        const status = !t
          ? null
          : done
            ? { text: "Tamam", bg: c.success, fg: "#fff", Icon: Check }
            : partial
              ? { text: `${t.myPages}/${t.myTarget} sf`, bg: "#f59e0b", fg: "#fff", Icon: BookOpen }
              : t.open
                ? { text: "Bekliyor", bg: c.primary + "1a", fg: c.primary, Icon: Clock }
                : { text: "Kapandı", bg: c.muted, fg: c.mutedForeground, Icon: Clock };
        const books = t?.books?.length ? t.books : booksOf(group).map((x) => x.title);
        return (
          <Pressable key={group.id} onPress={() => router.push(`/group/${group.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingLeft: 14, paddingRight: 10, overflow: "hidden" }}>
              {/* Kitap sırtı */}
              <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: cover }} />
              <BookCover name={group.name} color={cover} />
              <View style={{ flex: 1, gap: 3 }}>
                <Row gap={6}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, color: c.foreground }}>
                    {group.name}
                  </Text>
                  {role === "ADMIN" && <Crown size={13} color="#f59e0b" />}
                  <View style={{ flex: 1 }} />
                  {status && (
                    <Row gap={3} style={{ backgroundColor: status.bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <status.Icon size={11} color={status.fg} strokeWidth={3} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: status.fg }}>{status.text}</Text>
                    </Row>
                  )}
                </Row>
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>
                  {books.join(" · ")}
                  {t ? ` · günde ${t.myTarget} sf (alt ${t.myMin})` : ""}
                  {t?.teamName ? ` · ${t.teamName}` : ""}
                </Text>
                {t ? (
                  <Row gap={6}>
                    <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: c.muted, overflow: "hidden" }}>
                      <View style={{ width: `${members ? Math.round((t.reported / members) * 100) : 0}%`, height: "100%", borderRadius: 3, backgroundColor: c.success }} />
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: c.foreground }}>
                      {t.reported}/{members}
                    </Text>
                    {t.open ? <Countdown to={t.deadline} style={{ fontSize: 11 }} /> : <Muted style={{ fontSize: 11 }}>yeni gün {minuteToTime(group.startMinute)}</Muted>}
                  </Row>
                ) : (
                  <Muted style={{ fontSize: 11 }}>Son bildirim {minuteToTime(group.deadlineMinute)}</Muted>
                )}
                <Row gap={5} style={{ flexWrap: "wrap" }}>
                  <Row gap={3}>
                    {group.visibility === "PUBLIC" ? <Globe size={10} color={c.mutedForeground} /> : <Lock size={10} color={c.mutedForeground} />}
                    <Muted style={{ fontSize: 10 }}>{members} üye</Muted>
                  </Row>
                  {t && (
                    <Row gap={3}>
                      <Coins size={10} color={c.mutedForeground} />
                      <Muted numberOfLines={1} style={{ fontSize: 10 }}>
                        {t.penalty}
                      </Muted>
                    </Row>
                  )}
                  {!!t && t.debt > 0 && <Chip icon={Wallet} text={`borcun ${t.debt} TL`} tone="danger" />}
                  {!!t && t.debt > 0 && t.due && <DueBadge due={t.due} compact />}
                </Row>
              </View>
              <ChevronRight size={16} color={c.mutedForeground} />
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
                  onPress={() => bookCheck.check(g.id, teams[g.id], (bookLinks) => action.mutate({ name: "requestJoin", body: { groupId: g.id, message: notes[g.id], teamId: teams[g.id], bookLinks } }))}
                />
              </View>
            )}
          </Card>
        );
      })}
      {bookCheck.modal}
    </Screen>
  );
}
