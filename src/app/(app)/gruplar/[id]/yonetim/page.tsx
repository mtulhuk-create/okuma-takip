import { ArrowLeft, Ban, Check, Crown, MoreVertical, Receipt, Trash2, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cancelInvite, createDue, deleteGroup, kickOverdueAction, removeMember, resolvePayment, respondJoinRequest, respondTeamChange, setMemberTeam, toggleAdmin, waivePenalty } from "@/app/actions";
import { DiscountForm, ExtendForm } from "@/components/due-admin";
import { DueBadge } from "@/components/due-badge";
import { KefaretPanel } from "@/components/kefaret-panel";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { GroupForm } from "@/components/group-form";
import { TeamSelect } from "@/components/team-select";
import { UserSearch } from "@/components/user-search";
import { teamsActive } from "@/lib/rules";
import { requireUser } from "@/lib/auth";
import { getAdminData } from "@/lib/queries";
import { DAY, MIN, formatDateTime, formatDayKey } from "@/lib/schedule";

export const metadata = { title: "Grup yönetimi" };

const localInputValue = (date: Date, tz: number) => new Date(date.getTime() + tz * MIN).toISOString().slice(0, 16);

const DUE: Record<string, [string, string]> = {
  PENDING: ["Ödeme bekleniyor", "bg-amber-500/10 text-amber-700 dark:text-amber-400"],
  SUBMITTED: ["Onayını bekliyor", "bg-sky-500/10 text-sky-700 dark:text-sky-400"],
  CONFIRMED: ["Onaylandı", "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"],
  OVERDUE: ["Vade doldu · karar bekliyor", "bg-rose-500/10 text-rose-700 dark:text-rose-400"],
  EXPIRED: ["Ödemedi · çıkarıldı", "bg-rose-500/10 text-rose-700 dark:text-rose-400"],
  CANCELLED: ["İptal", "bg-muted text-muted-foreground"],
};

export default async function AdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "uyeler" } = await searchParams;
  const user = await requireUser();
  const data = await getAdminData(id, user.id);
  if (!data) redirect(`/gruplar/${id}`);
  const { group, members, requests, invites, dues, unpaidPenalties, money, teamChanges } = data;
  const hasTeams = teamsActive(group);
  const teamName = (id: string | null) => group.teams.find((t) => t.id === id)?.name;
  const overdue = dues.filter((d) => d.status === "OVERDUE");
  const openDues = dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED");
  const waiting = openDues.filter((d) => d.status === "SUBMITTED").length + overdue.length;
  const tabs = [
    { key: "uyeler", label: "Üyeler", count: 0 },
    { key: "davet", label: "Davet", count: requests.length + teamChanges.length },
    { key: "odemeler", label: "Ödemeler", count: waiting },
    { key: "ayarlar", label: "Ayarlar", count: 0 },
  ];

  return (
    <main className="space-y-4 pt-4">
      <div className="flex items-center gap-2">
        <Link href={`/gruplar/${id}`} className="btn-icon -ml-2" aria-label="Sohbete dön">
          <ArrowLeft />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Yönetim</p>
          <h1 className="truncate font-serif text-xl font-bold">{group.name}</h1>
        </div>
      </div>

      <nav className="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            replace
            scroll={false}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            {t.count > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === t.key ? "bg-primary-foreground/20" : "bg-destructive text-white"}`}>{t.count}</span>}
          </Link>
        ))}
      </nav>

      {tab === "uyeler" && (
        <section className="card divide-y divide-border p-0">
          {members.map((m) => {
            const mm = money[m.userId];
            const removable = m.userId !== group.ownerId && m.userId !== user.id;
            return (
              <div key={m.id} className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.user.name} src={m.user.imageUrl} initial={m.user.initial} seed={m.user.id} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {m.user.name}
                      {m.role === "ADMIN" && <Crown className="size-3.5 text-primary" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.teamsEnabled ? (group.teams.find((t) => t.id === m.teamId)?.name ?? "Ekipsiz") : "Üye"}
                      {mm?.unpaid ? <span className="font-semibold text-destructive"> · {mm.unpaid} TL borç</span> : null}
                      {mm?.inDue ? <span className="font-semibold text-amber-600"> · {mm.inDue} TL vadede</span> : null}
                    </p>
                  </div>
                  {(removable || mm?.unpaid || mm?.inDue || hasTeams) && (
                    <details className="relative">
                      <summary className="btn-icon size-9 list-none [&::-webkit-details-marker]:hidden" aria-label="İşlemler">
                        <MoreVertical />
                      </summary>
                      <div className="absolute right-0 z-30 mt-1 w-64 space-y-1 rounded-xl border border-border bg-card p-2 shadow-lg">
                        {mm?.unpaid ? (
                          <ActionForm action={createDue} className="space-y-2 rounded-lg bg-muted p-2">
                            <input type="hidden" name="groupId" value={id} />
                            <input type="hidden" name="userId" value={m.userId} />
                            <p className="flex items-center gap-1.5 text-xs font-semibold">
                              <Receipt className="size-3.5" /> {mm.unpaid} TL için son ödeme tarihi
                            </p>
                            <input type="datetime-local" name="dueAt" defaultValue={localInputValue(data.defaultDueAt, group.tzOffset)} className="input h-9" required />
                            <SubmitButton className="btn-primary btn-sm w-full">Vade ver</SubmitButton>
                          </ActionForm>
                        ) : null}
                        {mm?.unpaid || mm?.inDue ? <DiscountForm groupId={id} userId={m.userId} title="Bu üyenin cezalarına indirim" /> : null}
                        {hasTeams && (
                          <ActionForm action={setMemberTeam} className="flex gap-1.5 p-1">
                            <input type="hidden" name="memberId" value={m.id} />
                            <TeamSelect teams={group.teams} defaultValue={m.teamId} />
                            <SubmitButton className="btn-ghost btn-sm h-10">Ata</SubmitButton>
                          </ActionForm>
                        )}
                        {removable && (
                          <>
                            <ActionForm action={toggleAdmin}>
                              <input type="hidden" name="memberId" value={m.id} />
                              <SubmitButton className="btn-quiet btn-sm w-full justify-start">
                                <Crown /> {m.role === "ADMIN" ? "Yöneticiliği al" : "Yönetici yap"}
                              </SubmitButton>
                            </ActionForm>
                            <ActionForm action={removeMember} confirm={`${m.user.name} gruptan çıkarılsın mı?`}>
                              <input type="hidden" name="memberId" value={m.id} />
                              <SubmitButton className="btn-quiet btn-sm w-full justify-start text-destructive">
                                <UserMinus /> Gruptan çıkar
                              </SubmitButton>
                            </ActionForm>
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {tab === "davet" && (
        <>
          {requests.length > 0 && (
            <section className="card space-y-3">
              <h2 className="font-bold">Katılım istekleri</h2>
              {requests.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <Avatar name={r.user.name} src={r.user.imageUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.user.name}</p>
                    {(r.teamId || r.message) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {r.teamId && <b>{teamName(r.teamId)}</b>}
                        {r.teamId && r.message && " · "}
                        {r.message && `“${r.message}”`}
                      </p>
                    )}
                  </div>
                  <ActionForm action={respondJoinRequest} className="flex gap-1">
                    <input type="hidden" name="requestId" value={r.id} />
                    <SubmitButton name="accept" value="1" className="btn-primary size-9 p-0">
                      <Check />
                    </SubmitButton>
                    <SubmitButton name="accept" value="0" className="btn-ghost size-9 p-0">
                      <X />
                    </SubmitButton>
                  </ActionForm>
                </div>
              ))}
            </section>
          )}
          {teamChanges.length > 0 && (
            <section className="card space-y-3">
              <h2 className="font-bold">Ekip değişikliği istekleri</h2>
              {teamChanges.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <Avatar name={r.user.name} src={r.user.imageUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {teamName(members.find((m) => m.userId === r.userId)?.teamId ?? null) ?? "Ekipsiz"} → <b>{r.team.name}</b>
                    </p>
                  </div>
                  <ActionForm action={respondTeamChange} className="flex gap-1">
                    <input type="hidden" name="requestId" value={r.id} />
                    <SubmitButton name="accept" value="1" className="btn-primary size-9 p-0">
                      <Check />
                    </SubmitButton>
                    <SubmitButton name="accept" value="0" className="btn-ghost size-9 p-0">
                      <X />
                    </SubmitButton>
                  </ActionForm>
                </div>
              ))}
            </section>
          )}
          <section className="card space-y-3">
            <h2 className="font-bold">Kişi davet et</h2>
            <UserSearch groupId={id} />
            {invites.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="label">Bekleyen davetler</p>
                {invites.map((inv) => (
                  <ActionForm key={inv.id} action={cancelInvite} className="flex items-center justify-between gap-2">
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <span className="flex items-center gap-2 text-sm">
                      <Avatar name={inv.invitee.name} src={inv.invitee.imageUrl} size={28} />
                      {inv.invitee.name}
                    </span>
                    <SubmitButton className="btn-quiet btn-sm">Geri çek</SubmitButton>
                  </ActionForm>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "odemeler" && (
        <>
          {overdue.length === 0 && openDues.length === 0 && unpaidPenalties.length === 0 && <p className="card text-center text-sm text-muted-foreground">Bekleyen ödeme ya da ceza yok.</p>}

          {/* Vadesi dolanlar: gruptan çıkarılmadan önce yöneticiye sorulur */}
          {overdue.map((d) => (
            <section key={d.id} className="card space-y-3 border-rose-500/40">
              <div className="flex items-center gap-3">
                <Avatar name={d.user.name} src={d.user.imageUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Vade {formatDateTime(d.dueAt, group.tzOffset)}
                    {d.extensions ? ` · ${d.extensions} kez ek süre verildi` : ""}
                  </p>
                </div>
                <p className="text-lg font-bold text-destructive">{d.amount} TL</p>
              </div>
              <div className="space-y-1">
                <DueBadge due={d} />
                <p className="text-xs text-muted-foreground">
                  {group.kickOnExpire
                    ? d.decisionUntil
                      ? "Ek süre verebilir, indirim yapabilir, ikisini birden ya da hiçbirini uygulayabilirsin. Karar süresi bitince gruptan çıkarılır."
                      : "Karar bekleniyor."
                    : "Grup ayarında “vadesi dolanı çıkar” kapalı; borç açık kalır. İstersen ek süre ya da indirim uygulayabilirsin."}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ExtendForm dueId={d.id} defaultValue={localInputValue(new Date(Date.now() + 3 * DAY), group.tzOffset)} />
                <DiscountForm groupId={id} userId={d.userId} title={`${d.user.name.split(" ")[0]} için indirim`} />
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionForm action={resolvePayment}>
                  <input type="hidden" name="dueId" value={d.id} />
                  <SubmitButton name="decision" value="confirm" className="btn-success btn-sm">
                    <Check /> Ödedi, onayla
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={kickOverdueAction} confirm={`${d.user.name} gruptan çıkarılsın mı?`}>
                  <input type="hidden" name="dueId" value={d.id} />
                  <SubmitButton className="btn-ghost btn-sm text-destructive">
                    <UserMinus /> Gruptan çıkar
                  </SubmitButton>
                </ActionForm>
              </div>
            </section>
          ))}

          {openDues.map((d) => (
            <section key={d.id} className="card space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={d.user.name} src={d.user.imageUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.user.name}</p>
                  <div className="mt-0.5">
                    <DueBadge due={d} />
                  </div>
                </div>
                <p className="text-lg font-bold">{d.amount} TL</p>
              </div>
              {d.paymentNote && <p className="truncate text-xs text-muted-foreground">“{d.paymentNote}”</p>}
              <ActionForm action={resolvePayment} className="flex flex-wrap gap-2">
                <input type="hidden" name="dueId" value={d.id} />
                <SubmitButton name="decision" value="confirm" className="btn-success btn-sm">
                  <Check /> Ödemeyi onayla
                </SubmitButton>
                {d.status === "SUBMITTED" && (
                  <SubmitButton name="decision" value="reject" className="btn-ghost btn-sm">
                    <X /> Görmedim
                  </SubmitButton>
                )}
                <SubmitButton name="decision" value="cancel" className="btn-quiet btn-sm">
                  <Ban /> Vadeyi iptal et
                </SubmitButton>
              </ActionForm>
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Ek süre ya da indirim</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <ExtendForm dueId={d.id} defaultValue={localInputValue(new Date(d.dueAt.getTime() + 3 * DAY), group.tzOffset)} />
                  <DiscountForm groupId={id} userId={d.userId} title={`${d.user.name.split(" ")[0]} için indirim`} />
                </div>
              </details>
            </section>
          ))}

          <KefaretPanel groupId={id} />

          {unpaidPenalties.length > 0 && (
            <section className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">Ödenmemiş cezalar</h2>
                <span className="text-sm font-semibold text-destructive">{unpaidPenalties.reduce((s, p) => s + p.amount, 0)} TL</span>
              </div>
              <DiscountForm groupId={id} title="Toplu indirim (tüm grubun ödenmemiş cezaları)" />
              {/* Kişi bazında toplam; günler açılır listede */}
              <ul className="divide-y divide-border">
                {penaltyGroups(unpaidPenalties).map((g) => (
                  <li key={g.userId} className="space-y-1.5 py-2 text-sm">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{g.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {g.items.length} gün ceza{g.inDue ? ` · ${g.inDue} TL vadede` : ""}
                          </span>
                        </span>
                        <b className="shrink-0 text-destructive">
                          {g.original !== g.total && <s className="mr-1 font-normal text-muted-foreground">{g.original}</s>}
                          {g.total} TL
                        </b>
                        <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
                      </summary>
                      <ul className="mt-1.5 space-y-1 rounded-lg bg-muted/60 p-2 text-xs">
                        {g.items.map((p) => (
                          <li key={p.id} className="flex items-center gap-2">
                            <span className="flex-1">
                              {formatDayKey(p.dayKey)}
                              {p.status === "IN_DUE" && <span className="ml-1 text-amber-600">· vadede</span>}
                            </span>
                            {p.originalAmount != null && p.originalAmount !== p.amount && <s className="text-muted-foreground">{p.originalAmount}</s>}
                            <b>{p.amount} TL</b>
                            {p.status === "UNPAID" && (
                              <ActionForm action={waivePenalty}>
                                <input type="hidden" name="penaltyId" value={p.id} />
                                <SubmitButton className="btn-quiet btn-sm h-6 px-2 text-[11px]">Affet</SubmitButton>
                              </ActionForm>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                    {/* İndirim: kişinin tüm ödenmemiş cezalarına */}
                    <DiscountForm groupId={id} userId={g.userId} compact />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Kişinin satırındaki indirim, o kişinin tüm ödenmemiş cezalarına uygulanır. Vade için Üyeler sekmesinde kişinin menüsünü kullan.</p>
            </section>
          )}
          {dues.some((d) => !["PENDING", "SUBMITTED", "OVERDUE"].includes(d.status)) && (
            <details className="card">
              <summary className="cursor-pointer text-sm font-bold">Ödeme geçmişi</summary>
              <ul className="mt-2 divide-y divide-border text-sm">
                {dues
                  .filter((d) => !["PENDING", "SUBMITTED", "OVERDUE"].includes(d.status))
                  .map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2">
                      <span>
                        {d.user.name} · {d.amount} TL
                      </span>
                      <span className={`badge ${DUE[d.status][1]}`}>{DUE[d.status][0]}</span>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </>
      )}

      {tab === "ayarlar" && (
        <>
          <GroupForm group={group} />
          {group.ownerId === user.id && (
            <details className="card border-destructive/30">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-destructive">
                <Trash2 className="size-4" /> Grubu sil
              </summary>
              <ActionForm action={deleteGroup} className="mt-3 space-y-2">
                <input type="hidden" name="groupId" value={id} />
                <input name="confirm" placeholder={`Onay için "${group.name}" yazın`} className="input" />
                <SubmitButton className="btn-danger w-full">Grubu kalıcı olarak sil</SubmitButton>
              </ActionForm>
            </details>
          )}
        </>
      )}
    </main>
  );
}

type UnpaidPenalty = { id: string; userId: string; dayKey: string; amount: number; originalAmount: number | null; status: string; user: { name: string } };

/** Ödenmemiş cezalar kişi kişi: toplam, ilk tutar (indirim varsa) ve vadedeki kısım */
function penaltyGroups<P extends UnpaidPenalty>(list: P[]) {
  const map = new Map<string, { userId: string; name: string; items: P[]; total: number; original: number; inDue: number }>();
  for (const p of list) {
    const g = map.get(p.userId) ?? { userId: p.userId, name: p.user.name, items: [], total: 0, original: 0, inDue: 0 };
    g.items.push(p);
    g.total += p.amount;
    g.original += p.originalAmount ?? p.amount;
    if (p.status === "IN_DUE") g.inDue += p.amount;
    map.set(p.userId, g);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
