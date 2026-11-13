import { useBookCheck } from "@/components/book-match";
import { router } from "expo-router";
import { AlarmClock, BookOpen, CalendarDays, Check, ChevronRight, Clock, Coins, Crown, Globe, Lock, Plus, Search, Shield, Target, UserPlus, Users, Wallet } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Countdown } from "@/components/countdown";
import { DueBadge } from "@/components/due-badge";
import { JoinSheet } from "@/components/join-sheet";
import { Badge, Button, Card, ErrorView, H1, Input, Label, Loading, Muted, Row, Screen } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { LITE } from "@/lib/variant";
import { minuteToTime } from "@/lib/format";
import { fonts, STATE, useColors } from "@/lib/theme";
import { booksOf, describePenalty, formatAmount, teamsActive, type GroupsResponse } from "@/lib/types";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

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

/** Etiketli bilgi satırları: ne nerede olduğu ilk bakışta anlaşılsın */
function InfoRows({ rows }: { rows: { Icon: typeof BookOpen; label: string; value: string }[] }) {
  const c = useColors();
  return (
    <View style={{ gap: 2 }}>
      {rows.map(({ Icon, label, value }) => (
        <Row key={label} gap={6} style={{ alignItems: "flex-start" }}>
          <Icon size={12} color={c.primary} style={{ marginTop: 2 }} />
          <Text style={{ width: 74, fontFamily: fonts.regular, fontSize: 11.5, color: c.mutedForeground }}>{label}</Text>
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 11.5, color: c.foreground }}>{value}</Text>
        </Row>
      ))}
    </View>
  );
}

/** Gruplarım ve Keşfet için ortak kart başlığı: kitap kapağı, tam görünen grup adı, kısa bilgi */
function CardHead({ id, name, admin, meta, right }: { id: string; name: string; admin?: boolean; meta: { Icon: typeof BookOpen; text: string }[]; right?: React.ReactNode }) {
  const c = useColors();
  return (
    <Row gap={10} style={{ alignItems: "flex-start" }}>
      <BookCover name={name} color={coverColor(id)} />
      <View style={{ flex: 1, gap: 3 }}>
        <Row gap={5} style={{ alignItems: "flex-start" }}>
          <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: c.foreground }}>
            {name}
          </Text>
          {admin && <Crown size={13} color="#f59e0b" style={{ marginTop: 3 }} />}
          {right}
        </Row>
        <Row gap={8} style={{ flexWrap: "wrap" }}>
          {meta.map(({ Icon, text }) => (
            <Row key={text} gap={3}>
              <Icon size={11} color={c.mutedForeground} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>{text}</Text>
            </Row>
          ))}
        </Row>
      </View>
    </Row>
  );
}

/** Kartın sol kenarındaki kitap sırtı */
function Spine({ id }: { id: string }) {
  return <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: coverColor(id) }} />;
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
  const [joining, setJoining] = useState<{ id: string; name: string; teams: GroupsResponse["publicGroups"][number]["teams"] } | null>(null);

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
        const status = !t
          ? null
          : done
            ? { text: "Okudun", bg: STATE.read, fg: "#fff", Icon: Check }
            : partial
              ? { text: t.unit === "MINUTES" ? `${formatAmount(t.myPages ?? 0, t.unit)} / ${formatAmount(t.myTarget, t.unit)}` : `${t.myPages}/${t.myTarget} sf`, bg: STATE.min, fg: "#fff", Icon: BookOpen }
              : t.open
                ? { text: "Bekliyor", bg: c.primary + "1a", fg: c.primary, Icon: Clock }
                : { text: "Kapandı", bg: c.muted, fg: c.mutedForeground, Icon: Clock };
        const books = t?.books?.length ? t.books : booksOf(group).map((x) => x.title);
        return (
          <Pressable key={group.id} onPress={() => router.push(`/group/${group.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Card style={{ gap: 7, paddingVertical: 9, paddingLeft: 14, paddingRight: 11, overflow: "hidden" }}>
              <Spine id={group.id} />
              <CardHead
                id={group.id}
                name={group.name}
                admin={role === "ADMIN"}
                right={
                  <Row gap={4}>
                    {/* Sohbette okunmamış mesaj sayısı */}
                    {!!t?.unread && (
                      <View accessibilityLabel={`${t.unread} okunmamış mesaj`} style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, includeFontPadding: false, color: c.primaryForeground }}>{t.unread > 99 ? "99+" : t.unread}</Text>
                      </View>
                    )}
                    <ChevronRight size={16} color={c.mutedForeground} />
                  </Row>
                }
                meta={[
                  { Icon: Users, text: `${members} üye` },
                  { Icon: group.visibility === "PUBLIC" ? Globe : Lock, text: group.visibility === "PUBLIC" ? "Herkese açık" : "Özel" },
                  ...(t?.teamName ? [{ Icon: Shield, text: t.teamName }] : []),
                ]}
              />
              {/* Tek satırlık özet: eser · günlük sayfa · ceza (ayrıntı grubun içinde) */}
              <Row gap={10}>
                <Row gap={4} style={{ flexShrink: 1 }}>
                  <BookOpen size={12} color={c.primary} />
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.regular, fontSize: 11.5, color: c.mutedForeground }}>
                    {books[0]}
                  </Text>
                  {books.length > 1 && <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: c.mutedForeground }}>+{books.length - 1}</Text>}
                </Row>
                {t && (
                  <>
                    <Row gap={4}>
                      <Target size={12} color={c.primary} />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: c.mutedForeground }}>{formatAmount(t.myTarget, t.unit)}</Text>
                    </Row>
                    <Row gap={4}>
                      <Coins size={12} color={c.primary} />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: c.mutedForeground }}>{t.penaltyShort ?? t.penalty.split(" · ")[0]}</Text>
                    </Row>
                  </>
                )}
              </Row>
              {t && status ? (
                // Bugün
                <Row gap={7} style={{ backgroundColor: c.muted + "99", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 }}>
                  <Row gap={3} style={{ backgroundColor: status.bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <status.Icon size={11} color={status.fg} strokeWidth={3} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: status.fg }}>{status.text}</Text>
                  </Row>
                  <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: c.muted, overflow: "hidden" }}>
                    <View style={{ width: `${members ? Math.round((t.reported / members) * 100) : 0}%`, height: "100%", borderRadius: 3, backgroundColor: STATE.read }} />
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>
                    <Text style={{ fontFamily: fonts.bold, color: c.foreground }}>{t.reported}</Text>/{members} okudu
                  </Text>
                  {t.open ? (
                    <Row gap={2}>
                      <AlarmClock size={11} color={c.mutedForeground} />
                      <Countdown to={t.deadline} suffix="" style={{ fontSize: 11 }} />
                    </Row>
                  ) : (
                    <Muted style={{ fontSize: 11 }}>yeni gün {minuteToTime(group.startMinute)}</Muted>
                  )}
                </Row>
              ) : (
                <Muted style={{ fontSize: 11 }}>Son bildirim {minuteToTime(group.deadlineMinute)}</Muted>
              )}
              {!!t && t.debt > 0 && (
                <Row gap={5} style={{ flexWrap: "wrap" }}>
                  <Chip icon={Wallet} text={`Borcun ${t.debt} TL`} tone="danger" />
                  {t.due && <DueBadge due={t.due} compact />}
                </Row>
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
          <Card key={g.id} style={{ gap: 9, paddingVertical: 11, paddingLeft: 14, paddingRight: 11, overflow: "hidden" }}>
            <Spine id={g.id} />
            <Pressable onPress={() => router.push(`/group/${g.id}`)} style={{ gap: 8 }}>
              <CardHead
                id={g.id}
                name={g.name}
                meta={[
                  { Icon: Users, text: `${g._count.members} üye` },
                  ...(g.createdAt ? [{ Icon: CalendarDays, text: `Kuruluş: ${shortDate(g.createdAt)}` }] : []),
                  ...(hasTeams ? [{ Icon: Shield, text: `${g.teams.length} ekip` }] : []),
                ]}
              />
              {g.description ? (
                <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>
                  {g.description}
                </Text>
              ) : null}
              <InfoRows
                rows={[
                  { Icon: BookOpen, label: "Eserler", value: [...new Set((hasTeams ? g.teams.flatMap((t) => booksOf(t as never)) : books).map((b) => b.title))].join(", ") },
                  ...(hasTeams
                    ? []
                    : [
                        { Icon: Target, label: "Günlük", value: `${formatAmount(g.targetPages, g.readUnit, true)} · alt sınır ${formatAmount(g.minPages, g.readUnit)}` },
                        { Icon: Coins, label: "Ceza", value: describePenalty(g) },
                      ]),
                  { Icon: AlarmClock, label: "Son bildirim", value: minuteToTime(g.deadlineMinute) },
                ]}
              />
              {hasTeams && (
                // Ekipli gruplarda her ekibin hedefi ve cezası
                <View style={{ gap: 3, backgroundColor: c.muted + "99", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 }}>
                  {g.teams.map((t) => (
                    <Row key={t.id} gap={6} style={{ alignItems: "flex-start" }}>
                      <Shield size={12} color={c.primary} style={{ marginTop: 2 }} />
                      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 11.5, color: c.foreground }}>
                        <Text style={{ fontFamily: fonts.semibold }}>{t.name}: </Text>
                        günde {formatAmount(t.targetPages, t.readUnit, true)} · alt sınır {formatAmount(t.minPages, t.readUnit)} · {describePenalty(t)}
                      </Text>
                    </Row>
                  ))}
                </View>
              )}
            </Pressable>

            {requested.has(g.id) ? (
              <Row style={{ justifyContent: "space-between", backgroundColor: c.muted, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Badge text="İstek gönderildi" tone="warning" />
                <Button title="Geri çek" small variant="ghost" loading={busy("cancelJoinRequest", g.id)} onPress={() => action.mutate({ name: "cancelJoinRequest", body: { groupId: g.id } })} />
              </Row>
            ) : (
              <Button title="Katılma isteği gönder" icon={UserPlus} loading={busy("requestJoin", g.id)} onPress={() => setJoining({ id: g.id, name: g.name, teams: hasTeams ? g.teams : [] })} />
            )}
          </Card>
        );
      })}
      {bookCheck.modal}
      <JoinSheet
        group={joining}
        sending={action.isPending && action.variables?.name === "requestJoin"}
        onClose={() => setJoining(null)}
        onSubmit={(teamId, note) => {
          const g = joining!;
          bookCheck.check(g.id, teamId, (bookLinks) => action.mutate({ name: "requestJoin", body: { groupId: g.id, message: note, teamId, bookLinks } }, { onSuccess: () => setJoining(null) }));
        }}
      />
    </Screen>
  );
}
