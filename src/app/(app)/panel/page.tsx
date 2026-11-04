import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { PushToggle } from "@/components/push-toggle";
import { ReportButtons } from "@/components/report-buttons";
import { requireUser } from "@/lib/auth";
import { myGroupsToday, myMoney } from "@/lib/queries";
import { formatDateTime, formatDayKey, minuteToTime } from "@/lib/schedule";

export const metadata = { title: "Bugün" };

export default async function PanelPage() {
  const user = await requireUser();
  const [groups, money] = await Promise.all([myGroupsToday(user.id), myMoney(user.id)]);
  const firstName = user.name.split(" ")[0];

  return (
    <main className="space-y-4 pt-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Merhaba,</p>
          <h1 className="font-serif text-2xl font-bold">{firstName} 👋</h1>
        </div>
        <UserButton />
      </header>

      <PushToggle compact />

      {money.dues.map((d) => (
        <Link key={d.id} href={`/gruplar/${d.groupId}`} className="card block border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <p className="font-semibold text-rose-700 dark:text-rose-300">
            🧾 {d.group.name}: {d.amount} TL ceza ödemesi
          </p>
          <p className="text-sm text-destructive dark:text-rose-300">
            {d.status === "SUBMITTED" ? "Ödemen yönetici onayı bekliyor." : `Son ödeme: ${formatDateTime(d.dueAt, d.group.tzOffset)}`}
            {" · "}
            <Countdown to={d.dueAt.toISOString()} />
          </p>
        </Link>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="label">Aktif grup</p>
          <p className="text-2xl font-bold">{groups.length}</p>
        </div>
        <div className="card">
          <p className="label">Ödenmemiş ceza</p>
          <p className={`text-2xl font-bold ${money.unpaidTotal ? "text-destructive" : ""}`}>{money.unpaidTotal} TL</p>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="card text-center">
          <p className="text-4xl">📚</p>
          <p className="mt-2 font-semibold">Henüz bir okuma grubunda değilsin</p>
          <p className="mt-1 text-sm text-muted-foreground">Bir grup kur ya da herkese açık gruplara katıl.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/gruplar/yeni" className="btn-primary">
              Grup kur
            </Link>
            <Link href="/gruplar" className="btn-ghost">
              Gruplara göz at
            </Link>
          </div>
        </div>
      )}

      {groups.map(({ group, membership, period, open, myLog, reportedCount, memberCount }) => {
        const done = myLog && myLog.pages >= membership.dailyPages;
        return (
          <section key={group.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/gruplar/${group.id}`} className="block truncate font-serif text-lg font-bold hover:underline">
                  {group.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDayKey(period.dayKey)} · hedefin {membership.dailyPages} sayfa · {reportedCount}/{memberCount} kişi bildirdi
                </p>
              </div>
              {done ? (
                <span className="badge bg-emerald-100 text-emerald-700">Tamam ✓</span>
              ) : myLog ? (
                <span className="badge bg-amber-100 text-amber-700">Eksik</span>
              ) : (
                <span className="badge bg-muted text-foreground/80">Bekliyor</span>
              )}
            </div>
            {open ? (
              <>
                <p className="text-sm">
                  ⏰ Son bildirim <b>{minuteToTime(group.deadlineMinute)}</b> · <Countdown to={open.deadline.toISOString()} className="font-semibold" />
                </p>
                <ReportButtons groupId={group.id} dailyPages={membership.dailyPages} current={myLog?.pages ?? null} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bugünün bildirim süresi doldu. Yeni okuma günü <b>{minuteToTime(group.startMinute)}</b>&apos;de başlıyor (
                <Countdown to={period.nextStart.toISOString()} />
                ).
              </p>
            )}
          </section>
        );
      })}
    </main>
  );
}
