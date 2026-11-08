import { AlarmClock, BookOpen, Check, ChevronRight, Clock, Coins, Crown, Globe, Lock, Plus, Search, Shield, UserRound, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { cancelJoinRequest, requestJoin } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { JoinForm } from "@/components/join-form";
import { Countdown } from "@/components/countdown";
import { DueBadge } from "@/components/due-badge";
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

const COVERS = ["#9b2c2c", "#2f6f4f", "#1e4e79", "#8a5a1f", "#5b3a8a", "#0f766e", "#7c2d4a"];
function coverColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

/** Okuma grubunu temsil eden küçük kitap kapağı */
function BookCover({ name, color }: { name: string; color: string }) {
  return (
    <span className="relative flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[3px_7px_7px_3px] font-serif text-base font-bold text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
      <span className="absolute inset-y-0 left-1 w-px bg-white/35" aria-hidden />
      <span className="absolute inset-x-2 top-1.5 h-px bg-white/40" aria-hidden />
      <span className="absolute inset-x-2 bottom-1.5 h-px bg-white/40" aria-hidden />
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
            const pct = members ? Math.round((t.reported / members) * 100) : 0;
            const status = done
              ? { text: "Tamam", cls: "bg-emerald-600 text-white", Icon: Check }
              : partial
                ? { text: `${t.myPages}/${t.myTarget} sf`, cls: "bg-amber-500 text-white", Icon: BookOpen }
                : t.open
                  ? { text: "Bekliyor", cls: "bg-primary/10 text-primary", Icon: Clock }
                  : { text: "Kapandı", cls: "bg-muted text-muted-foreground", Icon: Clock };
            return (
              <Link
                key={group.id}
                href={`/gruplar/${group.id}`}
                prefetch
                className="card group relative flex items-center gap-3 overflow-hidden py-2.5 pl-4 pr-3 transition-colors hover:border-primary/40"
              >
                {/* Kitap sırtı */}
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: coverColor(group.id) }} aria-hidden />
                <BookCover name={group.name} color={coverColor(group.id)} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate font-semibold leading-tight">
                      {group.name}
                      {role === "ADMIN" && <Crown className="ml-1 inline size-3.5 -translate-y-px text-amber-500" aria-label="Yönetici" />}
                    </p>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.cls}`}>
                      <status.Icon className="size-3" strokeWidth={3} /> {status.text}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t.books.join(" · ")} · günde {t.myTarget} sf (alt {t.myMin}){t.teamName ? ` · ${t.teamName}` : ""}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-muted" title={`${t.reported}/${members} okudu`}>
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="shrink-0 font-semibold text-foreground">
                      {t.reported}/{members}
                    </span>
                    <span className="shrink-0">
                      {t.open ? <Countdown to={t.deadline} /> : `yeni gün ${minuteToTime(group.startMinute)}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {group.visibility === "PUBLIC" ? <Globe className="size-3" /> : <Lock className="size-3" />} {members} üye
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Coins className="size-3" /> {t.penalty}
                    </span>
                    {t.debt > 0 && (
                      <span className="badge bg-destructive/10 py-0 text-[10px] text-destructive">
                        <Wallet /> borcun {t.debt} TL
                      </span>
                    )}
                    {t.debt > 0 && t.due && <DueBadge due={t.due} compact />}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
                <JoinForm action={requestJoin} groupId={g.id} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="groupId" value={g.id} />
                  {teams.length > 0 && <TeamSelect teams={teams} />}
                  <input name="message" maxLength={300} placeholder="Not (isteğe bağlı)" className="input" />
                  <SubmitButton className="btn-primary shrink-0">Katılma isteği</SubmitButton>
                </JoinForm>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
