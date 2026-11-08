import { AlarmClock, BookOpen, Check, ChevronRight, Clock, Coins, Crown, Globe, Lock, Plus, Search, Shield, Target, UserRound, Users, Wallet } from "lucide-react";
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

/** Etiketli bilgi satırları: ne nerede olduğu ilk bakışta anlaşılsın */
function InfoRows({ rows }: { rows: { Icon: typeof Lock; label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="space-y-0.5 text-xs">
      {rows.map(({ Icon, label, value }) => (
        <div key={label} className="flex items-start gap-1.5">
          <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <dt className="w-[4.5rem] shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 flex-1 font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Gruplarım ve Keşfet için ortak kart başlığı: kitap kapağı, tam görünen grup adı, kısa bilgi */
function CardHead({ id, name, admin, meta, right }: { id: string; name: string; admin?: boolean; meta: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <BookCover name={name} color={coverColor(id)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <p className="min-w-0 flex-1 font-semibold leading-snug [overflow-wrap:anywhere]">
            {name}
            {admin && <Crown className="ml-1 inline size-3.5 -translate-y-px text-amber-500" aria-label="Yönetici" />}
          </p>
          {right}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

const cardCls = "card relative block space-y-2.5 overflow-hidden py-3 pl-4 pr-3";
const Spine = ({ id }: { id: string }) => <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: coverColor(id) }} aria-hidden />;

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
              ? { text: "Okudun", cls: "bg-emerald-500 text-white", Icon: Check }
              : partial
                ? { text: `${t.myPages}/${t.myTarget} sf`, cls: "bg-amber-500 text-white", Icon: BookOpen }
                : t.open
                  ? { text: "Bekliyor", cls: "bg-primary/10 text-primary", Icon: Clock }
                  : { text: "Kapandı", cls: "bg-muted text-muted-foreground", Icon: Clock };
            return (
              <Link key={group.id} href={`/gruplar/${group.id}`} prefetch className={`${cardCls} group transition-colors hover:border-primary/40`}>
                <Spine id={group.id} />
                <CardHead
                  id={group.id}
                  name={group.name}
                  admin={role === "ADMIN"}
                  right={<ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                  meta={
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" /> {members} üye
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {group.visibility === "PUBLIC" ? <Globe className="size-3" /> : <Lock className="size-3" />} {group.visibility === "PUBLIC" ? "Herkese açık" : "Özel"}
                      </span>
                      {t.teamName && (
                        <span className="inline-flex items-center gap-1">
                          <Shield className="size-3" /> {t.teamName}
                        </span>
                      )}
                    </>
                  }
                />
                <InfoRows
                  rows={[
                    { Icon: BookOpen, label: "Eserler", value: t.books.join(", ") },
                    { Icon: Target, label: "Günlük", value: `${t.myTarget} sayfa · alt sınır ${t.myMin}` },
                    { Icon: Coins, label: "Ceza", value: t.penalty },
                  ]}
                />
                {/* Bugün */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5">
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.cls}`}>
                    <status.Icon className="size-3" strokeWidth={3} /> {status.text}
                  </span>
                  <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted" title={`${t.reported}/${members} okudu`}>
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    <b className="text-foreground">{t.reported}</b>/{members} okudu
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t.open ? (
                      <>
                        <AlarmClock className="mr-0.5 inline size-3" />
                        <Countdown to={t.deadline} />
                      </>
                    ) : (
                      `yeni gün ${minuteToTime(group.startMinute)}`
                    )}
                  </span>
                </div>
                {t.debt > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="badge bg-destructive/10 text-destructive">
                      <Wallet /> Borcun {t.debt} TL
                    </span>
                    {t.due && <DueBadge due={t.due} compact />}
                  </div>
                )}
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
            <div key={g.id} className={cardCls}>
              <Spine id={g.id} />
              <CardHead
                id={g.id}
                name={g.name}
                meta={
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" /> {g._count.members} üye
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" /> Kurucu: {g.owner.name}
                    </span>
                  </>
                }
              />
              {g.description && <p className="line-clamp-2 text-xs text-muted-foreground">{g.description}</p>}
              {teams.length ? (
                <TeamTargets teams={teams} />
              ) : (
                <InfoRows
                  rows={[
                    { Icon: BookOpen, label: "Eserler", value: books.map((b) => b.title).join(", ") },
                    { Icon: Target, label: "Günlük", value: `${g.targetPages} sayfa · alt sınır ${g.minPages}` },
                    { Icon: Coins, label: "Ceza", value: describePenalty(g) },
                    { Icon: AlarmClock, label: "Son bildirim", value: minuteToTime(g.deadlineMinute) },
                  ]}
                />
              )}

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
