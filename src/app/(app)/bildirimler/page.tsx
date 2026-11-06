import { Bell, Mail } from "lucide-react";
import Link from "next/link";
import { respondInvite } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { JoinForm } from "@/components/join-form";
import { MarkSeen } from "@/components/mark-seen";
import { TeamSelect } from "@/components/team-select";
import { requireUser } from "@/lib/auth";
import { getNotificationsData } from "@/lib/queries";
import { teamsActive } from "@/lib/rules";
import { formatDateTime } from "@/lib/schedule";

export const metadata = { title: "Bildirimler" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const { invites, notes } = await getNotificationsData(user.id);

  return (
    <main className="space-y-5 pt-4">
      {/* Sayfa açılır açılmaz bildirimler okundu sayılır (rozet sıfırlanır); bu açılışta yeniler yine vurgulu görünür */}
      {notes.some((n) => !n.read) && <MarkSeen />}
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Bildirimler</h1>
      </header>

      {invites.map((inv) => (
        <div key={inv.id} className="card space-y-3 border-primary/30">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm">
                <b>{inv.inviter.name}</b> seni <b>{inv.group.name}</b> grubuna davet etti
              </p>
              <p className="text-xs text-muted-foreground">
                {inv.group._count.members} üye · günde {inv.group.targetPages} sayfa
              </p>
            </div>
          </div>
          <JoinForm action={respondInvite} groupId={inv.group.id} className="flex flex-wrap gap-2">
            <input type="hidden" name="inviteId" value={inv.id} />
            {teamsActive(inv.group) && <TeamSelect teams={inv.group.teams} />}
            <SubmitButton name="accept" value="1" className="btn-primary flex-1">
              Katıl
            </SubmitButton>
            <SubmitButton name="accept" value="0" className="btn-ghost flex-1">
              Reddet
            </SubmitButton>
          </JoinForm>
        </div>
      ))}

      {notes.length === 0 && invites.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Bell className="size-10 opacity-40" />
          <p className="text-sm">Henüz bildirim yok</p>
        </div>
      )}
      {notes.length > 0 && (
        <div className="card divide-y divide-border p-0">
          {notes.map((n) => {
            const body = (
              <div className="flex gap-3 p-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
              </div>
            );
            return n.url ? (
              <Link key={n.id} href={n.url} className="block transition-colors hover:bg-muted/60">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </main>
  );
}
