import Link from "next/link";
import { notFound } from "next/navigation";
import { leaveGroup, requestJoin, respondInvite, setDailyPages, submitPayment } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { CopyButton } from "@/components/copy-button";
import { Countdown } from "@/components/countdown";
import { ReportButtons } from "@/components/report-buttons";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { currentPeriod, formatDateTime, formatDayKey, minuteToTime, openPeriod, periodFor, shiftDayKey } from "@/lib/schedule";

function formatIban(iban: string) {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();
  const group = await db.group.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      members: { where: { status: "ACTIVE" }, include: { user: true }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!group) notFound();
  const me = group.members.find((m) => m.userId === user.id);
  const rules = (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="card p-3">
        <p className="label">Alt sınır</p>
        <p className="font-semibold">{group.minPages} sayfa/gün</p>
      </div>
      <div className="card p-3">
        <p className="label">Ceza</p>
        <p className="font-semibold">{group.penaltyMode === "FIXED" ? `${group.penaltyAmount} TL / gün` : `${group.penaltyAmount} TL / eksik sayfa`}</p>
      </div>
      <div className="card p-3">
        <p className="label">Okuma günü</p>
        <p className="font-semibold">
          {minuteToTime(group.startMinute)} → {minuteToTime(group.deadlineMinute)}
        </p>
      </div>
      <div className="card p-3">
        <p className="label">Uyarı</p>
        <p className="font-semibold">{group.reminderHours ? `${group.reminderHours} saat önce` : "Kapalı"} + son 10 dk</p>
      </div>
    </div>
  );

  // ---- Üye olmayan görünüm ----
  if (!me) {
    const [invite, request] = await Promise.all([
      db.invitation.findFirst({ where: { groupId: id, inviteeId: user.id, status: "PENDING" }, include: { inviter: true } }),
      db.joinRequest.findFirst({ where: { groupId: id, userId: user.id, status: "PENDING" } }),
    ]);
    if (group.visibility === "PRIVATE" && !invite) {
      return (
        <main className="space-y-4 pt-4 text-center">
          <p className="text-5xl">🔒</p>
          <h1 className="font-serif text-xl font-bold">Bu grup özel</h1>
          <p className="text-sm text-muted-foreground">Yalnızca yöneticinin davet ettiği kişiler katılabilir.</p>
          <Link href="/gruplar" className="btn-ghost">
            Gruplara dön
          </Link>
        </main>
      );
    }
    return (
      <main className="space-y-4 pt-4">
        <Link href="/gruplar" className="text-sm text-muted-foreground">
          ← Gruplar
        </Link>
        <h1 className="font-serif text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {group.members.length} üye · yönetici {group.owner.name}
        </p>
        {group.description && <p>{group.description}</p>}
        {rules}
        {invite ? (
          <div className="card space-y-2">
            <p className="text-sm">
              📩 <b>{invite.inviter.name}</b> seni bu gruba davet etti.
            </p>
            <ActionForm action={respondInvite} className="flex gap-2">
              <input type="hidden" name="inviteId" value={invite.id} />
              <SubmitButton name="accept" value="1" className="btn-success flex-1">
                Katıl
              </SubmitButton>
              <SubmitButton name="accept" value="0" className="btn-ghost flex-1">
                Reddet
              </SubmitButton>
            </ActionForm>
          </div>
        ) : request ? (
          <p className="card text-sm">⏳ Katılım isteğin yönetici onayı bekliyor.</p>
        ) : (
          <ActionForm action={requestJoin} className="card space-y-2">
            <input type="hidden" name="groupId" value={group.id} />
            <input name="message" maxLength={300} placeholder="Yöneticiye not (isteğe bağlı)" className="input" />
            <SubmitButton className="btn-primary w-full">Katılma isteği gönder</SubmitButton>
          </ActionForm>
        )}
      </main>
    );
  }

  // ---- Üye görünümü ----
  const now = new Date();
  const period = currentPeriod(now, group);
  const open = openPeriod(now, group);
  const days = Array.from({ length: 7 }, (_, i) => shiftDayKey(period.dayKey, i - 6));
  const [logs, penalties, dues] = await Promise.all([
    db.readingLog.findMany({ where: { groupId: id, dayKey: { in: days } } }),
    db.penalty.findMany({ where: { groupId: id, userId: user.id }, orderBy: { dayKey: "desc" }, take: 30 }),
    db.paymentDue.findMany({ where: { groupId: id, userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const logMap = new Map(logs.map((l) => [`${l.userId}:${l.dayKey}`, l]));
  const myToday = logMap.get(`${user.id}:${period.dayKey}`);
  const unpaid = penalties.filter((p) => p.status === "UNPAID" || p.status === "IN_DUE");
  const unpaidTotal = unpaid.reduce((s, p) => s + p.amount, 0);
  const openDues = dues.filter((d) => d.status === "PENDING" || d.status === "SUBMITTED");

  return (
    <main className="space-y-5 pt-4">
      <Link href="/gruplar" className="text-sm text-muted-foreground">
        ← Gruplar
      </Link>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.visibility === "PUBLIC" ? "🌍 Herkese açık" : "🔒 Özel"} · {group.members.length} üye
          </p>
        </div>
        {me.role === "ADMIN" && (
          <Link href={`/gruplar/${id}/yonetim`} className="btn-ghost shrink-0">
            ⚙️ Yönetim
          </Link>
        )}
      </header>
      {group.description && <p className="text-sm text-foreground/80">{group.description}</p>}

      {openDues.map((d) => (
        <section key={d.id} className="card space-y-3 border-rose-200 dark:border-rose-900">
          <h2 className="font-bold text-rose-700 dark:text-rose-300">🧾 Ödenecek ceza: {d.amount} TL</h2>
          <p className="text-sm">
            Son ödeme: <b>{formatDateTime(d.dueAt, group.tzOffset)}</b> (<Countdown to={d.dueAt.toISOString()} />
            ). Bu tarihe kadar ödemen yönetici tarafından onaylanmazsa gruptan otomatik çıkarılırsın.
          </p>
          <div className="rounded-xl bg-muted p-3">
            <p className="label">IBAN</p>
            <div className="flex items-center justify-between gap-2">
              <p className="break-all font-mono text-sm font-semibold">{formatIban(group.iban)}</p>
              <CopyButton text={group.iban} />
            </div>
            <p className="mt-1 text-sm">{group.ibanName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Açıklama: {user.name} — Okuma Takip cezası</p>
          </div>
          {d.status === "SUBMITTED" ? (
            <p className="text-sm font-semibold text-amber-600">⏳ Ödeme bildirdin, yönetici onayı bekleniyor.</p>
          ) : (
            <ActionForm action={submitPayment} className="space-y-2">
              <input type="hidden" name="dueId" value={d.id} />
              <input name="note" maxLength={300} placeholder="Not: gönderen ad, saat, banka vb." className="input" />
              <SubmitButton className="btn-success w-full">💳 Ödedim</SubmitButton>
            </ActionForm>
          )}
        </section>
      ))}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">📖 {formatDayKey(period.dayKey)}</h2>
          {open && <Countdown to={open.deadline.toISOString()} className="text-sm font-semibold" />}
        </div>
        {open ? (
          <ReportButtons groupId={id} dailyPages={me.dailyPages} current={myToday?.pages ?? null} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Bildirim süresi doldu. Yeni gün {minuteToTime(group.startMinute)}&apos;de başlıyor (<Countdown to={period.nextStart.toISOString()} />
            ).
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">👥 Son 7 gün</h2>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-1 py-1 text-left font-semibold">Üye</th>
                {days.map((d) => (
                  <th key={d} className="px-1 py-1 font-semibold">
                    {Number(d.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-2 pr-2 text-left">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.user.name} src={m.user.imageUrl} size={28} />
                      <div className="min-w-0">
                        <p className="max-w-[8rem] truncate font-medium">
                          {m.user.name}
                          {m.role === "ADMIN" && " ⭐"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{m.dailyPages} sf/gün</p>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const l = logMap.get(`${m.userId}:${d}`);
                    const isToday = d === period.dayKey;
                    const eligible = m.joinedAt <= periodFor(d, group).start;
                    const closed = !(isToday && open);
                    let cell = <span className="text-muted-foreground">·</span>;
                    if (l) {
                      cell = (
                        <span className={`text-xs font-bold ${l.pages >= l.requiredPages ? "text-emerald-600" : "text-destructive"}`}>{l.pages}</span>
                      );
                    } else if (closed && eligible) cell = <span className="text-rose-500">✗</span>;
                    else if (isToday && open) cell = <span className="text-muted-foreground">…</span>;
                    return (
                      <td key={d} className={`px-1 ${isToday ? "bg-accent/50" : ""}`}>
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rules}

      <section className="card space-y-2">
        <h2 className="font-bold">🎯 Günlük hedefim</h2>
        <ActionForm action={setDailyPages} className="flex flex-wrap gap-2">
          <input type="hidden" name="groupId" value={id} />
          <input name="dailyPages" type="number" min={group.minPages} max={1000} defaultValue={me.dailyPages} className="input w-28" />
          <SubmitButton className="btn-primary">Kaydet</SubmitButton>
        </ActionForm>
        <p className="text-xs text-muted-foreground">
          Bu sayının altında kalırsan ceza yazılır. En az {group.minPages} olabilir. Değişiklik bugünün bildirimi dahil geçerlidir.
        </p>
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">💸 Cezalarım</h2>
          <span className={`font-bold ${unpaidTotal ? "text-destructive" : "text-emerald-600"}`}>{unpaidTotal} TL ödenmemiş</span>
        </div>
        {penalties.length === 0 && <p className="text-sm text-muted-foreground">Hiç cezan yok, böyle devam! 🎉</p>}
        <ul className="divide-y divide-border text-sm">
          {penalties.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>
                {formatDayKey(p.dayKey)} · {p.pagesRead}/{p.requiredPages} sf
              </span>
              <span className="flex items-center gap-2">
                <b>{p.amount} TL</b>
                <PenaltyBadge status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ActionForm action={leaveGroup} confirm="Gruptan ayrılmak istediğine emin misin?" className="text-center">
        <input type="hidden" name="groupId" value={id} />
        <SubmitButton className="btn-ghost text-destructive">Gruptan ayrıl</SubmitButton>
      </ActionForm>
    </main>
  );
}

function PenaltyBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    UNPAID: ["Ödenmedi", "bg-rose-100 text-rose-700"],
    IN_DUE: ["Vadede", "bg-amber-100 text-amber-700"],
    PAID: ["Ödendi", "bg-emerald-100 text-emerald-700"],
    WAIVED: ["Affedildi", "bg-muted text-foreground/80"],
  };
  const [t, c] = map[status] ?? [status, ""];
  return <span className={`badge ${c}`}>{t}</span>;
}
