import { Lock, Mail, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requestJoin, respondInvite } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ChatView } from "@/components/chat/chat-view";
import { GroupRules } from "@/components/group-rules";
import { TeamSelect } from "@/components/team-select";
import { requireUser } from "@/lib/auth";
import { getChatPage } from "@/lib/chat";
import { getDb } from "@/lib/db";
import { getGroupDetail } from "@/lib/queries";
import { teamsActive } from "@/lib/rules";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const page = await getChatPage(id, user.id);
  if (!page) notFound();

  if (page.me) {
    const due = await getDb().paymentDue.findFirst({ where: { groupId: id, userId: user.id, status: "PENDING" }, select: { amount: true } });
    return <ChatView initial={page} dueBanner={due} />;
  }

  // ---- Üye olmayan görünüm ----
  const detail = (await getGroupDetail(id, user.id))!;
  const { group, invite, request } = detail;
  if (group.visibility === "PRIVATE" && !invite) {
    return (
      <main className="flex flex-col items-center gap-3 pt-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Lock className="size-7 text-muted-foreground" />
        </span>
        <h1 className="font-serif text-xl font-bold">Bu grup özel</h1>
        <p className="text-sm text-muted-foreground">Yalnızca yöneticinin davet ettiği kişiler katılabilir.</p>
        <Link href="/gruplar" className="btn-ghost">
          Gruplara dön
        </Link>
      </main>
    );
  }
  return (
    <main className="space-y-5 pt-4">
      <div>
        <h1 className="font-serif text-2xl font-bold">{group.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" /> {group.members.length} üye · yönetici {group.owner.name}
        </p>
      </div>
      {group.description && <p className="text-sm">{group.description}</p>}
      {!teamsActive(group) && <GroupRules group={group} />}
      {teamsActive(group) && (
        <div className="space-y-2">
          {group.teams.map((t) => (
            <GroupRules key={t.id} group={{ ...group, ...t }} title={`${t.name} ekibi`} />
          ))}
        </div>
      )}
      {invite ? (
        <div className="card space-y-3">
          <p className="flex items-center gap-2 text-sm">
            <Mail className="size-4 text-primary" /> <b>{invite.inviter.name}</b> seni bu gruba davet etti.
          </p>
          <ActionForm action={respondInvite} className="flex flex-wrap gap-2">
            <input type="hidden" name="inviteId" value={invite.id} />
            {teamsActive(group) && <TeamSelect teams={group.teams} />}
            <SubmitButton name="accept" value="1" className="btn-primary flex-1">
              Katıl
            </SubmitButton>
            <SubmitButton name="accept" value="0" className="btn-ghost flex-1">
              Reddet
            </SubmitButton>
          </ActionForm>
        </div>
      ) : request ? (
        <p className="card text-sm">Katılım isteğin yönetici onayı bekliyor.</p>
      ) : (
        <ActionForm action={requestJoin} className="card space-y-3">
          <input type="hidden" name="groupId" value={group.id} />
          {teamsActive(group) && (
            <div>
              <label className="label">Katılmak istediğin ekip</label>
              <TeamSelect teams={group.teams} />
            </div>
          )}
          <input name="message" maxLength={300} placeholder="Yöneticiye not (isteğe bağlı)" className="input" />
          <SubmitButton className="btn-primary w-full">Katılma isteği gönder</SubmitButton>
        </ActionForm>
      )}
    </main>
  );
}
