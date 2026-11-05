import { ChevronRight, Crown, Globe, Lock, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { cancelJoinRequest, requestJoin } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { TeamSelect } from "@/components/team-select";
import { requireUser } from "@/lib/auth";
import { getGroupsOverview } from "@/lib/queries";
import { teamsActive } from "@/lib/rules";

export const metadata = { title: "Gruplar" };

function GroupIcon({ name }: { name: string }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-lg font-bold text-primary-foreground">
      {name[0]?.toUpperCase()}
    </span>
  );
}

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const { mine, publicGroups, requestedIds } = await getGroupsOverview(user.id, q);
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

      <section>
        {mine.length === 0 ? (
          <p className="card text-sm text-muted-foreground">Henüz bir gruba üye değilsin. Bir grup kur ya da aşağıdan katıl.</p>
        ) : (
          <div className="card divide-y divide-border p-0">
            {mine.map(({ group, role }) => (
              <Link key={group.id} href={`/gruplar/${group.id}`} prefetch className="flex items-center gap-3 p-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60">
                <GroupIcon name={group.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {group.name}
                    {role === "ADMIN" && <Crown className="size-3.5 shrink-0 text-primary" />}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {group.visibility === "PUBLIC" ? <Globe className="size-3" /> : <Lock className="size-3" />}
                    {group._count.members} üye
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">Keşfet</h2>
        <form className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Herkese açık grup ara" className="input pl-9" />
        </form>
        {discover.length === 0 && <p className="text-sm text-muted-foreground">Grup bulunamadı.</p>}
        {discover.map((g) => (
          <div key={g.id} className="card space-y-3">
            <div className="flex items-start gap-3">
              <GroupIcon name={g.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" /> {g._count.members} üye · günde {g.targetPages} sayfa{teamsActive(g) ? ` · ${g.teams.length} ekip` : ""}
                </p>
                {g.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
              </div>
            </div>
            {requested.has(g.id) ? (
              <ActionForm action={cancelJoinRequest} className="flex items-center justify-between gap-2">
                <input type="hidden" name="groupId" value={g.id} />
                <span className="text-sm text-muted-foreground">İsteğin yönetici onayı bekliyor</span>
                <SubmitButton className="btn-quiet btn-sm">Geri çek</SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={requestJoin} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="groupId" value={g.id} />
                {teamsActive(g) && <TeamSelect teams={g.teams} />}
                <input name="message" maxLength={300} placeholder="Not (isteğe bağlı)" className="input" />
                <SubmitButton className="btn-primary shrink-0">Katılma isteği</SubmitButton>
              </ActionForm>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
