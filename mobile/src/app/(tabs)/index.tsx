import { Link, router } from "expo-router";
import { Pressable, View } from "react-native";
import { Countdown } from "@/components/countdown";
import { ReportButtons } from "@/components/report-buttons";
import { Avatar, Badge, Body, Button, Card, ErrorView, H1, Loading, Muted, Row, Screen, Stat, Title } from "@/components/ui";
import { useApi } from "@/lib/api";
import { formatDateTime, formatDayKey, minuteToTime } from "@/lib/format";
import type { MeResponse } from "@/lib/types";

export default function TodayScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useApi<MeResponse>("/api/m/me");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorView message={error?.message ?? "Yüklenemedi"} onRetry={refetch} />;
  const firstName = data.user.name.split(" ")[0];

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Row style={{ justifyContent: "space-between" }}>
        <View>
          <Muted>Merhaba,</Muted>
          <H1>{firstName} 👋</H1>
        </View>
        <Pressable onPress={() => router.push("/profile")}>
          <Avatar name={data.user.name} uri={data.user.imageUrl} size={42} />
        </Pressable>
      </Row>

      {data.money.dues.map((d) => (
        <Pressable key={d.id} onPress={() => router.push(`/group/${d.groupId}`)}>
          <Card tone="danger">
            <Title>
              🧾 {d.group.name}: {d.amount} TL ceza ödemesi
            </Title>
            <Body>
              {d.status === "SUBMITTED" ? "Ödemen yönetici onayı bekliyor." : `Son ödeme: ${formatDateTime(d.dueAt, d.group.tzOffset)}`}
            </Body>
            <Countdown to={d.dueAt} />
          </Card>
        </Pressable>
      ))}

      <Row gap={12}>
        <Stat label="Aktif grup" value={data.groups.length} />
        <Stat label="Ödenmemiş ceza" value={`${data.money.unpaidTotal} TL`} danger={data.money.unpaidTotal > 0} />
      </Row>

      {data.groups.length === 0 && (
        <Card style={{ alignItems: "center" }}>
          <Body style={{ fontSize: 40 }}>📚</Body>
          <Title>Henüz bir okuma grubunda değilsin</Title>
          <Muted style={{ textAlign: "center" }}>Bir grup kur ya da herkese açık gruplara katıl.</Muted>
          <Row>
            <Button title="Grup kur" onPress={() => router.push("/group/new")} />
            <Button title="Gruplara göz at" variant="ghost" onPress={() => router.push("/groups")} />
          </Row>
        </Card>
      )}

      {data.groups.map((g) => {
        const done = g.myPages != null && g.myPages >= g.dailyPages;
        return (
          <Card key={g.group.id}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Link href={`/group/${g.group.id}`}>
                  <Title numberOfLines={1} style={{ fontFamily: "LibreBaskerville_700Bold", fontSize: 17 }}>
                    {g.group.name}
                  </Title>
                </Link>
                <Muted>
                  {formatDayKey(g.period.dayKey)} · hedefin {g.dailyPages} sayfa · {g.reportedCount}/{g.memberCount} kişi bildirdi
                </Muted>
              </View>
              {done ? <Badge text="Tamam ✓" tone="success" /> : g.myPages != null ? <Badge text="Eksik" tone="warning" /> : <Badge text="Bekliyor" />}
            </Row>
            {g.open ? (
              <>
                <Row>
                  <Body>⏰ Son bildirim {minuteToTime(g.group.deadlineMinute)} ·</Body>
                  <Countdown to={g.open.deadline} />
                </Row>
                <ReportButtons groupId={g.group.id} dailyPages={g.dailyPages} current={g.myPages} />
              </>
            ) : (
              <Row style={{ flexWrap: "wrap" }}>
                <Muted>Bugünün bildirim süresi doldu. Yeni gün {minuteToTime(g.group.startMinute)}&apos;de başlıyor ·</Muted>
                <Countdown to={g.period.nextStart} style={{ fontSize: 12 }} />
              </Row>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
