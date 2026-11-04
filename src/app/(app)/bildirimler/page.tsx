import Link from "next/link";
import { markAllRead, respondInvite } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getNotificationsData } from "@/lib/queries";
import { formatDateTime } from "@/lib/schedule";

export const metadata = { title: "Bildirimler" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const { invites, notes } = await getNotificationsData(user.id);
  const unread = notes.some((n) => !n.read);

  return (
    <main className="space-y-5 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Bildirimler</h1>
        {unread && (
          <ActionForm action={markAllRead}>
            <SubmitButton className="btn-ghost btn-sm">Tümünü okundu yap</SubmitButton>
          </ActionForm>
        )}
      </header>

      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="label">Grup davetleri</h2>
          {invites.map((inv) => (
            <div key={inv.id} className="card space-y-2 border-primary/30">
              <p className="text-sm">
                📩 <b>{inv.inviter.name}</b> seni <b>{inv.group.name}</b> grubuna davet etti.
              </p>
              <p className="text-xs text-muted-foreground">
                {inv.group._count.members} üye · en az {inv.group.minPages} sayfa/gün ·{" "}
                {inv.group.penaltyMode === "FIXED" ? `${inv.group.penaltyAmount} TL/gün ceza` : `${inv.group.penaltyAmount} TL/eksik sayfa`}
              </p>
              <ActionForm action={respondInvite} className="flex gap-2">
                <input type="hidden" name="inviteId" value={inv.id} />
                <SubmitButton name="accept" value="1" className="btn-success flex-1">
                  Katıl
                </SubmitButton>
                <SubmitButton name="accept" value="0" className="btn-ghost flex-1">
                  Reddet
                </SubmitButton>
              </ActionForm>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        {notes.length === 0 && invites.length === 0 && <p className="text-center text-sm text-muted-foreground">Henüz bildirim yok.</p>}
        {notes.map((n) => {
          const body = (
            <>
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-foreground/80">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
            </>
          );
          const cls = `card block ${n.read ? "opacity-70" : "border-l-4 border-l-primary"}`;
          return n.url ? (
            <Link key={n.id} href={n.url} className={cls}>
              {body}
            </Link>
          ) : (
            <div key={n.id} className={cls}>
              {body}
            </div>
          );
        })}
      </section>
    </main>
  );
}
