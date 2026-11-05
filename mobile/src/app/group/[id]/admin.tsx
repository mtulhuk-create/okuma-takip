import { router, useLocalSearchParams } from "expo-router";
import { Ban, Check, ChevronDown, Crown, Receipt, Trash2, UserMinus, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { GroupForm } from "@/components/group-form";
import { DiscountControls, ExtendControls } from "@/components/due-admin";
import { DueBadge } from "@/components/due-badge";
import { DateTimeField } from "@/components/pickers";
import { TeamPicker } from "@/components/team-picker";
import { Avatar, Badge, Body, Button, Card, Divider, ErrorView, Input, Loading, Muted, Row, Screen, Title, type Tone } from "@/components/ui";
import { UserSearch } from "@/components/user-search";
import { useAction, useApi } from "@/lib/api";
import { formatDateTime, formatDayKey, toLocalInput } from "@/lib/format";
import { fonts, useColors } from "@/lib/theme";
import { teamsActive, type AdminResponse, type DueStatus } from "@/lib/types";

const DUE: Record<DueStatus, [string, Tone]> = {
  PENDING: ["Ödeme bekleniyor", "warning"],
  SUBMITTED: ["Onayını bekliyor", "info"],
  CONFIRMED: ["Onaylandı", "success"],
  OVERDUE: ["Vade doldu · karar bekliyor", "danger"],
  EXPIRED: ["Ödemedi · çıkarıldı", "danger"],
  CANCELLED: ["İptal", "neutral"],
};
const TABS = [
  { key: "members", label: "Üyeler" },
  { key: "invite", label: "Davet" },
  { key: "payments", label: "Ödemeler" },
  { key: "settings", label: "Ayarlar" },
] as const;

export default function AdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { data, isLoading, error, refetch, isRefetching } = useApi<AdminResponse & { group: AdminResponse["group"] & { teams: { id: string; name: string }[] } }>(`/api/m/groups/${id}/admin`);
  const action = useAction();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("members");
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [dueDates, setDueDates] = useState<Record<string, Date>>({});
  const [deleteText, setDeleteText] = useState("");
  const [fallbackDue] = useState(() => new Date(Date.now() + 3 * 86_400_000));
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const { group, members, requests, invites, dues, unpaidPenalties, money, teamChanges } = data;
  const hasTeams = teamsActive(group);
  const teamName = (tid: string | null) => group.teams.find((t) => t.id === tid)?.name;
  const run = (name: string, body: Record<string, unknown>) => action.mutate({ name, body });
  const overdue = dues.filter((d) => d.status === "OVERDUE");
  const openDues = dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED");
  const counts: Record<string, number> = { invite: requests.length + teamChanges.length, payments: openDues.filter((d) => d.status === "SUBMITTED").length + overdue.length };

  return (
    <Screen padTop={false} refreshing={isRefetching} onRefresh={refetch}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tab === t.key ? c.primary : c.muted }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: tab === t.key ? c.primaryForeground : c.mutedForeground }}>{t.label}</Text>
            {!!counts[t.key] && (
              <View style={{ backgroundColor: c.destructive, borderRadius: 99, paddingHorizontal: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: "#fff" }}>{counts[t.key]}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {tab === "members" && (
        <Card style={{ padding: 0, gap: 0 }}>
          {members.map((m, i) => {
            const mm = money[m.userId];
            const removable = m.userId !== group.ownerId;
            const open = openMember === m.id;
            const dueAt = dueDates[m.userId] ?? (data.defaultDueAt ? new Date(data.defaultDueAt) : fallbackDue);
            return (
              <View key={m.id} style={{ padding: 12, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <Pressable onPress={() => setOpenMember(open ? null : m.id)}>
                  <Row>
                    <Avatar name={m.user.name} uri={m.user.imageUrl} size={40} />
                    <View style={{ flex: 1 }}>
                      <Row gap={4}>
                        <Body numberOfLines={1} style={{ fontFamily: fonts.semibold, flexShrink: 1 }}>
                          {m.user.name}
                        </Body>
                        {m.role === "ADMIN" && <Crown size={14} color={c.primary} />}
                      </Row>
                      <Muted>
                        {hasTeams ? (teamName(m.teamId) ?? "Ekipsiz") : "Üye"}
                        {mm?.unpaid ? ` · ${mm.unpaid} TL borç` : ""}
                        {mm?.inDue ? ` · ${mm.inDue} TL vadede` : ""}
                      </Muted>
                    </View>
                    <ChevronDown size={18} color={c.mutedForeground} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
                  </Row>
                </Pressable>
                {open && (
                  <View style={{ gap: 10 }}>
                    {hasTeams && <TeamPicker teams={group.teams} value={m.teamId} onChange={(teamId) => run("setMemberTeam", { memberId: m.id, teamId })} label="Ekip" />}
                    {mm?.unpaid ? (
                      <Row style={{ alignItems: "flex-end" }}>
                        <DateTimeField label={`${mm.unpaid} TL için son ödeme`} value={dueAt} onChange={(d) => setDueDates((s) => ({ ...s, [m.userId]: d }))} />
                        <Button title="Vade ver" icon={Receipt} small onPress={() => run("createDue", { groupId: id, userId: m.userId, dueAt: toLocalInput(dueAt, group.tzOffset) })} />
                      </Row>
                    ) : null}
                    {mm?.unpaid || mm?.inDue ? <DiscountControls groupId={id} userId={m.userId} title="Bu üyenin cezalarına indirim" /> : null}
                    {removable && (
                      <Row>
                        <Button title={m.role === "ADMIN" ? "Yöneticiliği al" : "Yönetici yap"} icon={Crown} small variant="ghost" onPress={() => run("toggleAdmin", { memberId: m.id })} />
                        <Button
                          title="Çıkar"
                          icon={UserMinus}
                          small
                          variant="ghost"
                          textColor={c.destructive}
                          onPress={() =>
                            Alert.alert("Üyeyi çıkar", `${m.user.name} gruptan çıkarılsın mı?`, [
                              { text: "Vazgeç", style: "cancel" },
                              { text: "Çıkar", style: "destructive", onPress: () => run("removeMember", { memberId: m.id }) },
                            ])
                          }
                        />
                      </Row>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      )}

      {tab === "invite" && (
        <>
          {requests.length > 0 && (
            <Card>
              <Title>Katılım istekleri</Title>
              {requests.map((r) => (
                <Row key={r.id}>
                  <Avatar name={r.user.name} uri={r.user.imageUrl} size={38} />
                  <View style={{ flex: 1 }}>
                    <Body numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
                      {r.user.name}
                    </Body>
                    {(r.teamId || r.message) && (
                      <Muted numberOfLines={1}>
                        {r.teamId ? teamName(r.teamId) : ""}
                        {r.teamId && r.message ? " · " : ""}
                        {r.message ? `“${r.message}”` : ""}
                      </Muted>
                    )}
                  </View>
                  <Button title="" icon={Check} small onPress={() => run("respondJoinRequest", { requestId: r.id, accept: "1" })} />
                  <Button title="" icon={X} small variant="ghost" onPress={() => run("respondJoinRequest", { requestId: r.id, accept: "0" })} />
                </Row>
              ))}
            </Card>
          )}
          {teamChanges.length > 0 && (
            <Card>
              <Title>Ekip değişikliği istekleri</Title>
              {teamChanges.map((r) => (
                <Row key={r.id}>
                  <Avatar name={r.user.name} uri={r.user.imageUrl} size={38} />
                  <View style={{ flex: 1 }}>
                    <Body numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
                      {r.user.name}
                    </Body>
                    <Muted>
                      {teamName(members.find((m) => m.userId === r.userId)?.teamId ?? null) ?? "Ekipsiz"} → {r.team.name}
                    </Muted>
                  </View>
                  <Button title="" icon={Check} small onPress={() => run("respondTeamChange", { requestId: r.id, accept: "1" })} />
                  <Button title="" icon={X} small variant="ghost" onPress={() => run("respondTeamChange", { requestId: r.id, accept: "0" })} />
                </Row>
              ))}
            </Card>
          )}
          <Card>
            <Title>Kişi davet et</Title>
            <UserSearch groupId={id} />
            {invites.length > 0 && (
              <View style={{ gap: 6 }}>
                <Divider />
                <Muted>Bekleyen davetler</Muted>
                {invites.map((inv) => (
                  <Row key={inv.id} style={{ justifyContent: "space-between" }}>
                    <Body>{inv.invitee.name}</Body>
                    <Button title="Geri çek" small variant="ghost" onPress={() => run("cancelInvite", { inviteId: inv.id })} />
                  </Row>
                ))}
              </View>
            )}
          </Card>
        </>
      )}

      {tab === "payments" && (
        <>
          {overdue.length === 0 && openDues.length === 0 && unpaidPenalties.length === 0 && <Muted style={{ textAlign: "center" }}>Bekleyen ödeme ya da ceza yok.</Muted>}

          {/* Vadesi dolanlar: gruptan çıkarılmadan önce yöneticiye sorulur */}
          {overdue.map((d) => (
            <Card key={d.id} tone="danger">
              <Row>
                <Avatar name={d.user?.name ?? "?"} uri={d.user?.imageUrl} size={38} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: fonts.semibold }}>{d.user?.name}</Body>
                  <Muted>
                    Vade {formatDateTime(d.dueAt, group.tzOffset)}
                    {d.extensions ? ` · ${d.extensions} kez ek süre` : ""}
                  </Muted>
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: c.destructive }}>{d.amount} TL</Text>
              </Row>
              <DueBadge due={d} />
              <Muted>
                {group.kickOnExpire === false
                  ? "Vadesi dolanı çıkarma ayarı kapalı; borç açık kalır. İstersen ek süre ya da indirim uygula."
                  : "Ek süre verebilir, indirim yapabilir, ikisini birden ya da hiçbirini uygulayabilirsin. Karar süresi bitince gruptan çıkarılır."}
              </Muted>
              <ExtendControls dueId={d.id} tzOffset={group.tzOffset}  />
              <DiscountControls groupId={id} userId={d.userId} title={`${d.user?.name.split(" ")[0] ?? "Üye"} için indirim`} />
              <Row style={{ flexWrap: "wrap" }}>
                <Button title="Ödedi, onayla" icon={Check} small variant="success" onPress={() => run("resolvePayment", { dueId: d.id, decision: "confirm" })} />
                <Button
                  title="Gruptan çıkar"
                  icon={UserMinus}
                  small
                  variant="ghost"
                  textColor={c.destructive}
                  onPress={() =>
                    Alert.alert("Gruptan çıkar", `${d.user?.name} gruptan çıkarılsın mı?`, [
                      { text: "Vazgeç", style: "cancel" },
                      { text: "Çıkar", style: "destructive", onPress: () => run("kickOverdue", { dueId: d.id }) },
                    ])
                  }
                />
              </Row>
            </Card>
          ))}

          {openDues.map((d) => (
            <Card key={d.id}>
              <Row>
                <Avatar name={d.user?.name ?? "?"} uri={d.user?.imageUrl} size={38} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Body style={{ fontFamily: fonts.semibold }}>{d.user?.name}</Body>
                  <DueBadge due={d} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: c.foreground }}>{d.amount} TL</Text>
              </Row>
              {d.paymentNote && <Muted>“{d.paymentNote}”</Muted>}
              <Row style={{ flexWrap: "wrap" }}>
                <Button title="Onayla" icon={Check} small variant="success" onPress={() => run("resolvePayment", { dueId: d.id, decision: "confirm" })} />
                {d.status === "SUBMITTED" && <Button title="Görmedim" icon={X} small variant="ghost" onPress={() => run("resolvePayment", { dueId: d.id, decision: "reject" })} />}
                <Button title="İptal" icon={Ban} small variant="ghost" onPress={() => run("resolvePayment", { dueId: d.id, decision: "cancel" })} />
                <Button title={openMember === `due-${d.id}` ? "Kapat" : "Ek süre / indirim"} icon={ChevronDown} small variant="ghost" onPress={() => setOpenMember((o) => (o === `due-${d.id}` ? null : `due-${d.id}`))} />
              </Row>
              {openMember === `due-${d.id}` && (
                <>
                  <ExtendControls dueId={d.id} tzOffset={group.tzOffset} from={d.dueAt} />
                  <DiscountControls groupId={id} userId={d.userId} title={`${d.user?.name.split(" ")[0] ?? "Üye"} için indirim`} />
                </>
              )}
            </Card>
          ))}

          {unpaidPenalties.length > 0 && (
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Title>Ödenmemiş cezalar</Title>
                <Text style={{ fontFamily: fonts.bold, color: c.destructive }}>{unpaidPenalties.reduce((s, p) => s + p.amount, 0)} TL</Text>
              </Row>
              <DiscountControls groupId={id} title="Toplu indirim (tüm grubun ödenmemiş cezaları)" />
              {unpaidPenalties.map((p) => (
                <View key={p.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
                  <Row>
                    <Body numberOfLines={1} style={{ flex: 1 }}>
                      {p.user?.name} · {formatDayKey(p.dayKey)}
                      {p.status === "IN_DUE" ? " · vadede" : ""}
                    </Body>
                    {p.originalAmount != null && p.originalAmount !== p.amount && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground, textDecorationLine: "line-through" }}>{p.originalAmount}</Text>}
                    <Body style={{ fontFamily: fonts.bold }}>{p.amount} TL</Body>
                  </Row>
                  <Row style={{ justifyContent: "flex-end" }}>
                    <DiscountControls groupId={id} penaltyId={p.id} compact />
                    {p.status === "UNPAID" && <Button title="Affet" small variant="ghost" onPress={() => run("waivePenalty", { penaltyId: p.id })} />}
                  </Row>
                </View>
              ))}
              <Muted>Bir kişinin tüm cezalarına indirim ya da vade için Üyeler sekmesinde kişiye dokun.</Muted>
            </Card>
          )}
          {dues.some((d) => ["CONFIRMED", "EXPIRED", "CANCELLED"].includes(d.status)) && (
            <Card>
              <Title>Ödeme geçmişi</Title>
              {dues
                .filter((d) => ["CONFIRMED", "EXPIRED", "CANCELLED"].includes(d.status))
                .map((d) => (
                  <Row key={d.id} style={{ justifyContent: "space-between" }}>
                    <Body numberOfLines={1} style={{ flex: 1 }}>
                      {d.user?.name} · {d.amount} TL
                    </Body>
                    <Badge text={DUE[d.status][0]} tone={DUE[d.status][1]} />
                  </Row>
                ))}
            </Card>
          )}
        </>
      )}

      {tab === "settings" && (
        <>
          <GroupForm group={group} submitLabel="Ayarları kaydet" submitting={action.isPending && action.variables?.name === "updateGroup"} onSubmit={(body) => run("updateGroup", body)} />
          {group.ownerId && (
            <Card tone="danger">
              <Row>
                <Trash2 size={18} color={c.destructive} />
                <Title style={{ color: c.destructive }}>Grubu sil</Title>
              </Row>
              <Muted>Yalnızca grubu kuran silebilir. Onay için grup adını yazın.</Muted>
              <Input placeholder={group.name} value={deleteText} onChangeText={setDeleteText} />
              <Button title="Grubu kalıcı olarak sil" variant="danger" disabled={deleteText !== group.name} onPress={() => action.mutate({ name: "deleteGroup", body: { groupId: id, confirm: deleteText } }, { onSuccess: () => router.replace("/groups") })} />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
