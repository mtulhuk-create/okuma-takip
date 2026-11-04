import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  cancelInvite,
  createDue,
  deleteGroup,
  removeMember,
  resolvePayment,
  respondJoinRequest,
  toggleAdmin,
  waivePenalty,
} from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { GroupForm } from "@/components/group-form";
import { UserSearch } from "@/components/user-search";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { DAY, MIN, formatDateTime, formatDayKey } from "@/lib/schedule";

export const metadata = { title: "Grup yönetimi" };

function localInputValue(date: Date, tz: number) {
  return new Date(date.getTime() + tz * MIN).toISOString().slice(0, 16);
}

const dueStatus: Record<string, [string, string]> = {
  PENDING: ["Ödeme bekleniyor", "bg-amber-100 text-amber-700"],
  SUBMITTED: ["Onay bekliyor", "bg-sky-100 text-sky-700"],
  CONFIRMED: ["Onaylandı", "bg-emerald-100 text-emerald-700"],
  EXPIRED: ["Süresi doldu · atıldı", "bg-rose-100 text-rose-700"],
  CANCELLED: ["İptal", "bg-muted text-foreground/80"],
};

export default async function AdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();
  const group = await db.group.findUnique({ where: { id } });
  if (!group) notFound();
  const me = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: user.id } } });
  if (!me || me.status !== "ACTIVE" || me.role !== "ADMIN") redirect(`/gruplar/${id}`);

  const [members, requests, invites, dues, unpaidPenalties] = await Promise.all([
    db.groupMember.findMany({ where: { groupId: id, status: "ACTIVE" }, include: { user: true }, orderBy: { joinedAt: "asc" } }),
    db.joinRequest.findMany({ where: { groupId: id, status: "PENDING" }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.invitation.findMany({ where: { groupId: id, status: "PENDING" }, include: { invitee: true } }),
    db.paymentDue.findMany({ where: { groupId: id }, include: { user: true }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 50 }),
    db.penalty.findMany({ where: { groupId: id, status: { in: ["UNPAID", "IN_DUE"] } }, include: { user: true }, orderBy: { dayKey: "desc" } }),
  ]);
  const byUser = new Map<string, { unpaid: number; inDue: number }>();
  for (const p of unpaidPenalties) {
    const e = byUser.get(p.userId) ?? { unpaid: 0, inDue: 0 };
    if (p.status === "UNPAID") e.unpaid += p.amount;
    else e.inDue += p.amount;
    byUser.set(p.userId, e);
  }
  const defaultDue = localInputValue(new Date(Date.now() + 3 * DAY), group.tzOffset);
  const openDues = dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED");
  const pastDues = dues.filter((d) => d.status !== "PENDING" && d.status !== "SUBMITTED");

  return (
    <main className="space-y-6 pt-4">
      <Link href={`/gruplar/${id}`} className="text-sm text-muted-foreground">
        ← {group.name}
      </Link>
      <h1 className="font-serif text-2xl font-bold">⚙️ Grup yönetimi</h1>

      {requests.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-bold">🙋 Katılım istekleri ({requests.length})</h2>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <Avatar name={r.user.name} src={r.user.imageUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.user.name}</p>
                {r.message && <p className="text-xs text-muted-foreground">“{r.message}”</p>}
              </div>
              <ActionForm action={respondJoinRequest} className="flex gap-1">
                <input type="hidden" name="requestId" value={r.id} />
                <SubmitButton name="accept" value="1" className="btn-success btn-sm">
                  Kabul
                </SubmitButton>
                <SubmitButton name="accept" value="0" className="btn-ghost btn-sm">
                  Red
                </SubmitButton>
              </ActionForm>
            </div>
          ))}
        </section>
      )}

      {openDues.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-bold">💳 Açık ödemeler</h2>
          {openDues.map((d) => (
            <div key={d.id} className="space-y-2 rounded-xl bg-muted/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {d.user.name} · {d.amount} TL
                </p>
                <span className={`badge ${dueStatus[d.status][1]}`}>{dueStatus[d.status][0]}</span>
              </div>
              <p className="text-xs text-muted-foreground">Vade: {formatDateTime(d.dueAt, group.tzOffset)}</p>
              {d.paymentNote && <p className="text-xs">Not: “{d.paymentNote}”</p>}
              <ActionForm action={resolvePayment} className="flex flex-wrap gap-1">
                <input type="hidden" name="dueId" value={d.id} />
                <SubmitButton name="decision" value="confirm" className="btn-success btn-sm">
                  ✅ Ödemeyi onayla
                </SubmitButton>
                {d.status === "SUBMITTED" && (
                  <SubmitButton name="decision" value="reject" className="btn-ghost btn-sm">
                    Görmedim / reddet
                  </SubmitButton>
                )}
                <SubmitButton name="decision" value="cancel" className="btn-ghost btn-sm">
                  Vadeyi iptal et
                </SubmitButton>
              </ActionForm>
            </div>
          ))}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-bold">👥 Üyeler ({members.length})</h2>
        {members.map((m) => {
          const money = byUser.get(m.userId);
          return (
            <div key={m.id} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex items-center gap-3">
                <Avatar name={m.user.name} src={m.user.imageUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {m.user.name} {m.role === "ADMIN" && <span className="badge bg-accent text-primary">Yönetici</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.dailyPages} sf/gün
                    {money?.unpaid ? <span className="font-semibold text-destructive"> · {money.unpaid} TL ödenmemiş</span> : null}
                    {money?.inDue ? <span className="font-semibold text-amber-600"> · {money.inDue} TL vadede</span> : null}
                  </p>
                </div>
              </div>
              {money?.unpaid ? (
                <ActionForm action={createDue} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="groupId" value={id} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <input type="datetime-local" name="dueAt" defaultValue={defaultDue} className="input w-auto flex-1" required />
                  <SubmitButton className="btn-primary btn-sm">🧾 {money.unpaid} TL için vade ver</SubmitButton>
                </ActionForm>
              ) : null}
              {m.userId !== group.ownerId && m.userId !== user.id && (
                <div className="flex gap-1">
                  <ActionForm action={toggleAdmin}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <SubmitButton className="btn-ghost btn-sm">{m.role === "ADMIN" ? "Yöneticiliği al" : "Yönetici yap"}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={removeMember} confirm={`${m.user.name} gruptan çıkarılsın mı?`}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <SubmitButton className="btn-ghost btn-sm text-destructive">Çıkar</SubmitButton>
                  </ActionForm>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">📩 Davet et</h2>
        <UserSearch groupId={id} />
        {invites.length > 0 && (
          <div className="space-y-2">
            <p className="label">Bekleyen davetler</p>
            {invites.map((inv) => (
              <ActionForm key={inv.id} action={cancelInvite} className="flex items-center justify-between gap-2">
                <input type="hidden" name="inviteId" value={inv.id} />
                <span className="text-sm">{inv.invitee.name}</span>
                <SubmitButton className="btn-ghost btn-sm">İptal</SubmitButton>
              </ActionForm>
            ))}
          </div>
        )}
      </section>

      {unpaidPenalties.some((p) => p.status === "UNPAID") && (
        <section className="card space-y-2">
          <h2 className="font-bold">💸 Ödenmemiş cezalar</h2>
          <ul className="divide-y divide-border text-sm">
            {unpaidPenalties
              .filter((p) => p.status === "UNPAID")
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    {p.user.name} · {formatDayKey(p.dayKey)} · {p.pagesRead}/{p.requiredPages} sf
                  </span>
                  <ActionForm action={waivePenalty} className="flex items-center gap-2">
                    <input type="hidden" name="penaltyId" value={p.id} />
                    <b>{p.amount} TL</b>
                    <SubmitButton className="btn-ghost btn-sm">Affet</SubmitButton>
                  </ActionForm>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-serif text-xl font-bold">Ayarlar</h2>
        <GroupForm group={group} />
      </section>

      {pastDues.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-bold">📜 Ödeme geçmişi</h2>
          <ul className="divide-y divide-border text-sm">
            {pastDues.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span>
                  {d.user.name} · {d.amount} TL
                </span>
                <span className={`badge ${dueStatus[d.status][1]}`}>{dueStatus[d.status][0]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {group.ownerId === user.id && (
        <section className="card space-y-2 border-rose-200 dark:border-rose-900">
          <h2 className="font-bold text-destructive">Grubu sil</h2>
          <ActionForm action={deleteGroup} className="space-y-2">
            <input type="hidden" name="groupId" value={id} />
            <input name="confirm" placeholder={`Onay için "${group.name}" yazın`} className="input" />
            <SubmitButton className="btn-danger w-full">Grubu kalıcı olarak sil</SubmitButton>
          </ActionForm>
        </section>
      )}
    </main>
  );
}
