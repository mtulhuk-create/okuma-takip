import { AlarmClock, BookOpen, Check, ChevronRight, Clock, Coins, Crown, Globe, Lock, Plus, Search, Shield, UserRound, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { cancelJoinRequest, requestJoin } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Countdown } from "@/components/countdown";
import { TeamSelect } from "@/components/team-select";
import { requireUser } from "@/lib/auth";
import { getGroupsOverview } from "@/lib/queries";
import { booksOf, describePenalty, teamsActive } from "@/lib/rules";
import { minuteToTime } from "@/lib/schedule";

export const metadata = { title: "Gruplar" };

function GroupIcon({ name, size = "size-12" }: { name: string; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 font-serif text-lg font-bold text-primary-foreground shadow-xs`}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

type Rulesish = Parameters<typeof booksOf>[0] & Parameters<typeof describePenalty>[0];

/** Ekiplerin günlük hedefleri: katılmadan önce kim ne kadar okuyacak görünsün */
function TeamTargets({ teams }: { teams: (Rulesish & { id: string; name: string })[] }) {
  return (
    <div className="rounded-xl border border-border">
      <p className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Shield className="size-3.5 text-primary" /> Ekipler ve günlük hedefleri
      </p>
      <ul className="divide-y divide-border">
        {teams.map((t) => {
          const books = booksOf(t);
          return (
            <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{books.map((b) => b.title).join(" · ")}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold">
                  {t.targetPages} <span className="text-[11px] font-normal text-muted-foreground">sf/gün</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  alt sınır {t.minPages} · {describePenalty(t)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const { mine, today, publicGroups, requestedIds } = await getGroupsOverview(user.id, q);
  const myIds = new Set(mine.map((m) => m.groupId));
  const requested = new Set(requestedIds);
  const discover = publicGroups.filter((g) => !myIds.has(g.id));

  return (
    <main className="space-y-6 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Gruplar</h1>
        <Link href="/gruplar/yeni" className="btn-primary">
          <Plus /> Grup kur
        </Link>
      </header>

      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-muted-foreground">Gruplarım</h2>
        {mine.length === 0 ? (
          <p className="card text-sm text-muted-foreground">Henüz bir gruba üye değilsin. Bir grup kur ya da aşağıdan katıl.</p>
        ) : (
          mine.map(({ group, role }) => {
            const t = today.find((x) => x.groupId === group.id)!;
            const members = group._count.members;
            const done = t.myPages != null && t.myPages >= t.myTarget;
            const partial = t.myPages != null && !done;
            return (
              <Link key={group.id} href={`/gruplar/${group.id}`} prefetch className="card group block space-y-2.5 p-3 transition-colors hover:border-primary/40">
                <div className="flex items-center gap-3">
                  <GroupIcon name={group.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <span className="truncate">{group.name}</span>
                      {role === "ADMIN" && <Crown className="size-3.5 shrink-0 text-amber-500" aria-label="Yönetici" />}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {group.visibility === "PUBLIC" ? <Globe className="size-3" /> : <Lock className="size-3" />}
                        {members} üye
                      </span>
                      {t.teamName && (
                        <span className="flex items-center gap-1">
                          <Shield className="size-3" /> {t.teamName}
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>

                {/* Bugünkü durum */}
                <div className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${done ? "bg-emerald-500/10" : partial ? "bg-amber-500/10" : t.open ? "bg-primary/5" : "bg-muted"}`}>
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-600 text-white" : partial ? "bg-amber-500 text-white" : "bg-card text-muted-foreground"}`}>
                    {done ? <Check className="size-4" strokeWidth={3} /> : partial ? <BookOpen className="size-3.5" /> : <Clock className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-[13px] font-semibold">
                      {done ? "Bugünkü okuman tamam" : partial ? `Bugün ${t.myPages}/${t.myTarget} sayfa` : t.open ? "Bugün henüz bildirmedin" : "Okuma günü kapandı"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.open ? (
                        <>
                          <Countdown to={t.deadline} /> · {minuteToTime(group.deadlineMinute)}&apos;e kadar
                        </>
                      ) : (
                        `Yeni gün ${minuteToTime(group.startMinute)}'de başlar`
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">
                      {t.reported}/{members}
                    </p>
                    <p className="text-[10px] text-muted-foreground">okudu</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="badge bg-muted text-foreground">
                    <BookOpen /> günde {t.myTarget} sf · alt {t.myMin}
                  </span>
                  <span className="badge bg-muted text-foreground">
                    <Coins /> {t.penalty}
                  </span>
                  {t.debt > 0 && (
                    <span className="badge bg-destructive/10 text-destructive">
                      <Wallet /> borcun {t.debt} TL
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">Keşfet</h2>
        <form className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Herkese açık grup ara" className="input pl-9" />
        </form>
        {discover.length === 0 && <p className="text-sm text-muted-foreground">Grup bulunamadı.</p>}
        {discover.map((g) => {
          const teams = teamsActive(g) ? g.teams : [];
          const books = booksOf(g);
          return (
            <div key={g.id} className="card space-y-3 p-3.5">
              <div className="flex items-start gap-3">
                <GroupIcon name={g.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" /> {g._count.members} üye
                    </span>
                    <span className="flex items-center gap-1">
                      <UserRound className="size-3" /> {g.owner.name}
                    </span>
                  </p>
                  {g.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
                </div>
              </div>

              {teams.length ? (
                <TeamTargets teams={teams} />
              ) : (
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-muted/60 px-2 py-2">
                    <BookOpen className="mx-auto mb-0.5 size-4 text-primary" />
                    <p className="text-sm font-bold leading-tight">{g.targetPages} sf</p>
                    <p className="text-[10px] text-muted-foreground">günlük · alt {g.minPages}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 px-2 py-2">
                    <Coins className="mx-auto mb-0.5 size-4 text-primary" />
                    <p className="text-sm font-bold leading-tight">{g.penaltyAmount} TL</p>
                    <p className="text-[10px] text-muted-foreground">{g.penaltyMode === "PER_PAGE" ? "eksik sayfa başı" : g.minDiscount ? `alt sınırda %${g.minDiscount} ind.` : "günlük ceza"}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 px-2 py-2">
                    <AlarmClock className="mx-auto mb-0.5 size-4 text-primary" />
                    <p className="text-sm font-bold leading-tight">{minuteToTime(g.deadlineMinute)}</p>
                    <p className="text-[10px] text-muted-foreground">son bildirim</p>
                  </div>
                </div>
              )}
              {!teams.length && <p className="truncate text-[11px] text-muted-foreground">📖 {books.map((b) => b.title).join(" · ")}</p>}

              {requested.has(g.id) ? (
                <ActionForm action={cancelJoinRequest} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
                  <input type="hidden" name="groupId" value={g.id} />
                  <span className="text-sm text-muted-foreground">İsteğin yönetici onayı bekliyor</span>
                  <SubmitButton className="btn-quiet btn-sm">Geri çek</SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={requestJoin} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="groupId" value={g.id} />
                  {teams.length > 0 && <TeamSelect teams={teams} />}
                  <input name="message" maxLength={300} placeholder="Not (isteğe bağlı)" className="input" />
                  <SubmitButton className="btn-primary shrink-0">Katılma isteği</SubmitButton>
                </ActionForm>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
