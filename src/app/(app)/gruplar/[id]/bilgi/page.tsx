import { BadgeChip } from "@/components/badge-chip";
import { StreakChip } from "@/components/history-grid";
import { ArrowLeft, Crown, LogOut, Receipt, Settings, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { leaveGroup, requestTeamChange, submitPayment } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { CopyButton } from "@/components/copy-button";
import { DueBadge } from "@/components/due-badge";
import { Countdown } from "@/components/countdown";
import { GroupRules } from "@/components/group-rules";
import { TeamSelect } from "@/components/team-select";
import { teamsActive } from "@/lib/rules";
import { requireUser } from "@/lib/auth";
import { getGroupDetail } from "@/lib/queries";
import { formatDateTime, formatDayKey } from "@/lib/schedule";

export const metadata = { title: "Grup bilgisi" };

const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

export default async function GroupInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const detail = await getGroupDetail(id, user.id);
  if (!detail) notFound();
  const { group, me, board, myRules, teamChange } = detail;
  if (!me || !board) redirect(`/gruplar/${id}`);
  const { penalties, dues } = board;
  const unpaid = penalties.filter((p) => p.status === "UNPAID" || p.status === "IN_DUE");
  const unpaidTotal = unpaid.reduce((s, p) => s + p.amount, 0);
  const openDues = dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED" || d.status === "OVERDUE");

  return (
    <main className="space-y-5 pt-4">
      <div className="flex items-center gap-2">
        <Link href={`/gruplar/${id}`} className="btn-icon -ml-2" aria-label="Sohbete dön">
          <ArrowLeft />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-serif text-xl font-bold">{group.name}</h1>
        {me.role === "ADMIN" && (
          <Link href={`/gruplar/${id}/yonetim`} className="btn-ghost btn-sm">
            <Settings /> Yönetim
          </Link>
        )}
      </div>
      {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}

      {openDues.map((d) => (
        <section key={d.id} className="card space-y-3 border-destructive/30">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Receipt className="size-5" />
            </span>
            <div>
              <h2 className="font-bold">{d.amount} TL ceza ödemesi</h2>
              <div className="mt-1">
                <DueBadge due={d} />
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="break-all font-mono text-sm font-semibold">{formatIban(group.iban)}</p>
              <CopyButton text={group.iban} />
            </div>
            <p className="mt-1 text-sm">{group.ibanName}</p>
          </div>
          {d.status === "OVERDUE" ? (
            <p className="text-sm font-semibold text-destructive">
              Vaden doldu. Ödediysen yöneticiye haber ver; yönetici ek süre ya da indirim verebilir.
              {group.kickOnExpire && d.decisionUntil ? " Karar süresi bitince gruptan çıkarılabilirsin." : ""}
            </p>
          ) : d.status === "SUBMITTED" ? (
            <p className="text-sm font-semibold text-amber-600">Ödeme bildirdin, yönetici onayı bekleniyor.</p>
          ) : (
            <ActionForm action={submitPayment} className="space-y-2">
              <input type="hidden" name="dueId" value={d.id} />
              <input name="note" maxLength={300} placeholder="Not: gönderen ad, saat vb. (isteğe bağlı)" className="input" />
              <SubmitButton className="btn-success w-full">Ödedim</SubmitButton>
              {group.kickOnExpire && <p className="text-xs text-muted-foreground">Vade bitene kadar ödenmezse yönetici ek süre vermezse gruptan çıkarılırsın.</p>}
            </ActionForm>
          )}
        </section>
      ))}

      <GroupRules group={{ ...group, ...myRules! }} title={myRules?.teamName ? `${myRules.teamName} ekibinin kuralları` : undefined} />

      {teamsActive(group) && (
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <h2 className="flex-1 font-bold">Ekibim</h2>
            <span className="badge bg-primary/10 text-primary">{myRules?.teamName ?? "Seçilmedi"}</span>
          </div>
          {teamChange ? (
            <p className="text-sm text-muted-foreground">
              <b className="text-foreground">{teamChange.team.name}</b> ekibine geçme isteğin yönetici onayı bekliyor.
            </p>
          ) : (
            <ActionForm action={requestTeamChange} className="flex gap-2">
              <input type="hidden" name="groupId" value={id} />
              <TeamSelect teams={group.teams.filter((t) => t.id !== me.teamId)} />
              <SubmitButton className="btn-ghost shrink-0">{me.teamId && me.role !== "ADMIN" ? "İstek gönder" : "Geç"}</SubmitButton>
            </ActionForm>
          )}
          {me.teamId && me.role !== "ADMIN" && <p className="text-xs text-muted-foreground">Ekip değişikliği yönetici onayıyla gerçekleşir.</p>}
        </section>
      )}

      <section className="card">
        <div className="mb-2 flex items-center gap-2">
          <Wallet className="size-5 text-primary" />
          <h2 className="flex-1 font-bold">Cezalarım</h2>
          <span className={`text-sm font-bold ${unpaidTotal ? "text-destructive" : "text-emerald-600"}`}>{unpaidTotal ? `${unpaidTotal} TL` : "Yok"}</span>
        </div>
        {unpaid.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {unpaid.slice(0, 10).map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span className="text-muted-foreground">
                  {formatDayKey(p.dayKey)} · {p.pagesRead}/{p.requiredPages} sf
                </span>
                <b>{p.amount} TL</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ödenmemiş cezan yok.</p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">{group.members.length} üye</h2>
        <ul className="space-y-2.5">
          {group.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar name={m.user.name} src={m.user.imageUrl} initial={m.user.initial} seed={m.user.id} size={36} frame={m.tier} />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
                <span className="truncate">
                  {m.user.name}
                  {m.userId === user.id && <span className="text-muted-foreground"> (sen)</span>}
                </span>
                {m.badge && <BadgeChip tag={m.badge} />}
                <StreakChip s={m.streak} />
              </span>
              {m.role === "ADMIN" && (
                <span className="badge bg-primary/10 text-primary">
                  <Crown /> Yönetici
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <ActionForm action={leaveGroup} confirm="Gruptan ayrılmak istediğine emin misin?">
        <input type="hidden" name="groupId" value={id} />
        <SubmitButton className="btn-quiet w-full text-destructive">
          <LogOut /> Gruptan ayrıl
        </SubmitButton>
      </ActionForm>
    </main>
  );
}
