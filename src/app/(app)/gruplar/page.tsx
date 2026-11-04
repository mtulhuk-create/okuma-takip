import Link from "next/link";
import { cancelJoinRequest, requestJoin } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { minuteToTime } from "@/lib/schedule";

export const metadata = { title: "Gruplar" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const db = getDb();
  const [mine, publicGroups, myRequests] = await Promise.all([
    db.groupMember.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: { group: { include: { _count: { select: { members: { where: { status: "ACTIVE" } } } } } } },
    }),
    db.group.findMany({
      where: {
        visibility: "PUBLIC",
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
      },
      include: { _count: { select: { members: { where: { status: "ACTIVE" } } } }, owner: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.joinRequest.findMany({ where: { userId: user.id, status: "PENDING" }, select: { groupId: true } }),
  ]);
  const myIds = new Set(mine.map((m) => m.groupId));
  const requested = new Set(myRequests.map((r) => r.groupId));

  return (
    <main className="space-y-6 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Gruplar</h1>
        <Link href="/gruplar/yeni" className="btn-primary">
          + Grup kur
        </Link>
      </header>

      <section className="space-y-2">
        <h2 className="label">Gruplarım</h2>
        {mine.length === 0 && <p className="text-sm text-muted-foreground">Henüz bir gruba üye değilsin.</p>}
        {mine.map(({ group, role, dailyPages }) => (
          <Link key={group.id} href={`/gruplar/${group.id}`} className="card flex items-center justify-between gap-3 hover:border-primary/30">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {group.visibility === "PUBLIC" ? "🌍" : "🔒"} {group.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {group._count.members} üye · hedefin {dailyPages} sayfa · son saat {minuteToTime(group.deadlineMinute)}
              </p>
            </div>
            {role === "ADMIN" && <span className="badge bg-accent text-primary">Yönetici</span>}
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="label">Herkese açık gruplar</h2>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Grup ara..." className="input" />
          <button className="btn-ghost">Ara</button>
        </form>
        {publicGroups.length === 0 && <p className="text-sm text-muted-foreground">Grup bulunamadı.</p>}
        {publicGroups.map((g) => (
          <div key={g.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/gruplar/${g.id}`} className="font-semibold hover:underline">
                  🌍 {g.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {g._count.members} üye · yönetici {g.owner.name} · en az {g.minPages} sayfa/gün ·{" "}
                  {g.penaltyMode === "FIXED" ? `${g.penaltyAmount} TL/gün` : `${g.penaltyAmount} TL/eksik sayfa`}
                </p>
              </div>
            </div>
            {g.description && <p className="text-sm text-foreground/80">{g.description}</p>}
            {myIds.has(g.id) ? (
              <span className="badge bg-emerald-100 text-emerald-700">Üyesin</span>
            ) : requested.has(g.id) ? (
              <ActionForm action={cancelJoinRequest} className="flex items-center gap-2">
                <input type="hidden" name="groupId" value={g.id} />
                <span className="badge bg-amber-100 text-amber-700">İstek gönderildi</span>
                <SubmitButton className="btn-ghost btn-sm">Geri çek</SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={requestJoin} className="flex gap-2">
                <input type="hidden" name="groupId" value={g.id} />
                <input name="message" maxLength={300} placeholder="Yöneticiye not (isteğe bağlı)" className="input" />
                <SubmitButton className="btn-primary shrink-0">Katılma isteği</SubmitButton>
              </ActionForm>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
