import { UserButton } from "@clerk/nextjs";
import { CalendarDays, Plus, Receipt, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { DayCardMini } from "@/components/day-card";
import { PushToggle } from "@/components/push-toggle";
import { MyHistory } from "@/components/my-history";
import { DebtButton } from "@/components/pay-sheet";
import { DueBadge } from "@/components/due-badge";
import { requireUser } from "@/lib/auth";
import { getMyHistory } from "@/lib/history";
import { myGroupsToday, myMoney } from "@/lib/queries";
import { formatDateTime } from "@/lib/schedule";

export const metadata = { title: "Bugün" };

export default async function PanelPage() {
  const user = await requireUser();
  const [groups, money, history] = await Promise.all([myGroupsToday(user.id), myMoney(user.id), getMyHistory(user.id, "7d")]);

  return (
    <main className="space-y-5 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Merhaba,</p>
          <h1 className="truncate font-serif text-2xl font-bold">{user.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DebtButton total={money.unpaidTotal} items={money.debts} />
          <UserButton />
        </div>
      </header>

      <MyHistory initial={history} />

      <PushToggle compact />

      {money.dues.map((d) => (
        <Link key={d.id} href={`/gruplar/${d.groupId}/bilgi`} className="card flex items-center gap-3 border-destructive/30 bg-destructive/5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Receipt className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {d.group.name} · {d.amount} TL ödeme
            </p>
            <div className="mt-0.5">
              <DueBadge due={d} />
            </div>
          </div>
        </Link>
      ))}

      {money.unpaidTotal > 0 && (
        <div className="card flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Wallet className="size-5 text-muted-foreground" />
          </span>
          <p className="flex-1 text-sm">Ödenmemiş cezan</p>
          <p className="text-lg font-bold text-destructive">{money.unpaidTotal} TL</p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="size-7" />
          </span>
          <div>
            <p className="font-semibold">Henüz bir okuma grubunda değilsin</p>
            <p className="mt-1 text-sm text-muted-foreground">Bir grup kur ya da herkese açık gruplara katıl.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/gruplar/yeni" className="btn-primary">
              <Plus /> Grup kur
            </Link>
            <Link href="/gruplar" className="btn-ghost">
              <Search /> Gruplara göz at
            </Link>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground">Bugünün okumaları</h2>
          {groups.map((g) => (
            <DayCardMini key={g.group.id} card={g.card} groupId={g.group.id} groupName={g.group.name} />
          ))}
        </section>
      )}

    </main>
  );
}
