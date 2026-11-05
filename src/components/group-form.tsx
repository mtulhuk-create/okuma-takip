"use client";

import type { Group, Team } from "@prisma/client";
import { AlarmClock, BookOpen, ChevronDown, Globe, Landmark, Lock, PencilLine, Plus, Shield, ShieldCheck, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { createGroup, updateGroup } from "@/app/actions";
import { pickRules, type Rules } from "@/lib/rules";
import { minuteToTime, periodLengthMinutes, timeToMinute } from "@/lib/schedule";
import { ActionForm, SubmitButton } from "./action-form";
import { RulesEditor, Tiles } from "./rules-editor";

function Section({ Icon, title, hint, children }: { Icon: typeof Lock; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="font-bold leading-tight">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** 24 saatlik çubukta okuma gününü gösterir (gece yarısını geçebilir) */
function Timeline({ start, deadline, reminderHours }: { start: number; deadline: number; reminderHours: number }) {
  const len = periodLengthMinutes({ startMinute: start, deadlineMinute: deadline });
  const segs = start + len <= 1440 ? [[start, start + len]] : [[start, 1440], [0, start + len - 1440]];
  const remind = (deadline - reminderHours * 60 + 1440) % 1440;
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  return (
    <div className="pt-1">
      <div className="relative h-3 rounded-full bg-muted">
        {segs.map(([a, b], i) => (
          <span key={i} className="absolute inset-y-0 rounded-full bg-primary/70" style={{ left: pct(a), width: pct(b - a) }} />
        ))}
        {reminderHours > 0 && <span className="absolute -top-1 h-5 w-1 rounded-full bg-amber-500" style={{ left: pct(remind) }} title="Uyarı" />}
        <span className="absolute -top-1 h-5 w-1 rounded-full bg-destructive" style={{ left: pct(deadline) }} title="Son saat" />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-primary/70" /> Okuma süresi ({Math.round(len / 60)} sa)
        </span>
        {reminderHours > 0 && (
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" /> Uyarı
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-destructive" /> Son bildirim
        </span>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, title, desc }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-3">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-muted transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-card after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5" />
    </label>
  );
}

type TeamDraft = Rules & { id?: string; name: string; key: string };
const DEFAULT_RULES: Rules = { penaltyMode: "FIXED", targetPages: 20, minPages: 10, penaltyAmount: 20, minDiscount: 50, books: [{ id: "kitap1", title: "", targetPages: 20, minPages: 10 }] };

function TeamCard({ team, index, canRemove, onChange, onRemove }: { team: TeamDraft; index: number; canRemove: boolean; onChange: (t: TeamDraft) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 p-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
        <input className="input h-9" value={team.name} maxLength={40} placeholder={`${index + 1}. ekip adı`} onChange={(e) => onChange({ ...team, name: e.target.value })} />
        <button type="button" className="btn-icon size-9" onClick={() => setOpen((o) => !o)} aria-label="Kuralları göster">
          <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {canRemove && (
          <button type="button" className="btn-icon size-9" onClick={onRemove} aria-label="Ekibi sil">
            <Trash2 />
          </button>
        )}
      </div>
      {!open && (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          {team.books.length} eser · günde {team.targetPages} sayfa · alt sınır {team.minPages} · {team.penaltyMode === "FIXED" ? `${team.penaltyAmount} TL (%${team.minDiscount} indirim)` : `${team.penaltyAmount} TL/eksik sayfa`}
        </p>
      )}
      {open && (
        <div className="border-t border-border p-3">
          <RulesEditor value={team} onChange={(r) => onChange({ ...team, ...r })} />
        </div>
      )}
    </div>
  );
}

export function GroupForm({ group }: { group?: Group & { teams?: Team[] } }) {
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">(group?.visibility ?? "PRIVATE");
  const [chatPolicy, setChatPolicy] = useState<"ALL" | "ADMINS">(group?.chatPolicy ?? "ALL");
  const [shareProgress, setShareProgress] = useState(group?.shareProgress ?? false);
  const [rules, setRules] = useState<Rules>(group ? pickRules(group) : DEFAULT_RULES);
  const [teamsEnabled, setTeamsEnabled] = useState(group?.teamsEnabled ?? false);
  const [teams, setTeams] = useState<TeamDraft[]>(
    group?.teams?.length ? group.teams.map((t) => ({ ...pickRules(t), id: t.id, name: t.name, key: t.id })) : [],
  );
  const [start, setStart] = useState(group?.startMinute ?? 0);
  const [deadline, setDeadline] = useState(group?.deadlineMinute ?? 1439);
  const [reminderHours, setReminderHours] = useState(group?.reminderHours ?? 2);
  const [iban, setIban] = useState(group?.iban ?? "");

  const nextDay = deadline <= start;
  const newTeam = (n: number): TeamDraft => ({
    ...rules,
    books: rules.books.map((b) => ({ ...b, id: `${b.id}-${n}` })),
    name: `${String.fromCharCode(65 + n)} Ekibi`,
    key: `new-${Date.now()}-${n}`,
  });
  function toggleTeams(on: boolean) {
    setTeamsEnabled(on);
    if (on && teams.length < 2) setTeams((t) => [...t, ...Array.from({ length: 2 - t.length }, (_, i) => newTeam(t.length + i))]);
  }

  return (
    <ActionForm action={group ? updateGroup : createGroup} className="space-y-4">
      {group && <input type="hidden" name="groupId" value={group.id} />}
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="chatPolicy" value={chatPolicy} />
      <input type="hidden" name="penaltyMode" value={rules.penaltyMode} />
      <input type="hidden" name="targetPages" value={rules.targetPages} />
      <input type="hidden" name="minPages" value={rules.minPages} />
      <input type="hidden" name="penaltyAmount" value={rules.penaltyAmount} />
      <input type="hidden" name="minDiscount" value={rules.minDiscount} />
      <input type="hidden" name="books" value={JSON.stringify(rules.books)} />
      <input type="hidden" name="shareProgress" value={shareProgress ? "1" : "0"} />
      <input type="hidden" name="teamsEnabled" value={teamsEnabled ? "1" : "0"} />
      <input type="hidden" name="teams" value={JSON.stringify(teams.map(({ key: _k, ...t }) => t))} />
      <input type="hidden" name="startTime" value={minuteToTime(start)} />
      <input type="hidden" name="deadlineTime" value={minuteToTime(deadline)} />
      <input type="hidden" name="reminderHours" value={reminderHours} />

      <Section Icon={PencilLine} title="Temel bilgiler">
        <div>
          <label className="label">Grup adı</label>
          <input name="name" required minLength={3} maxLength={80} className="input" defaultValue={group?.name} placeholder="Örn. Sabah Okurları" />
        </div>
        <div>
          <label className="label">Açıklama (isteğe bağlı)</label>
          <textarea name="description" maxLength={500} rows={2} className="input" defaultValue={group?.description ?? ""} placeholder="Grubun amacı, okunan kitap..." />
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section Icon={Users} title="Kimler katılabilir?">
          <Tiles
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "PRIVATE", Icon: Lock, title: "Özel", desc: "Yalnızca davetle" },
              { value: "PUBLIC", Icon: Globe, title: "Herkese açık", desc: "Listede görünür, istek alınır" },
            ]}
          />
        </Section>
        <Section Icon={ShieldCheck} title="Kimler yazabilir?">
          <Tiles
            value={chatPolicy}
            onChange={setChatPolicy}
            options={[
              { value: "ALL", Icon: Users, title: "Tüm üyeler", desc: "Herkes mesaj ve anket atar" },
              { value: "ADMINS", Icon: ShieldCheck, title: "Yöneticiler", desc: "Üyeler yalnızca okur" },
            ]}
          />
          <Toggle
            checked={shareProgress}
            onChange={setShareProgress}
            title="Okuyucular birbirinin geçmişini görsün"
            desc="Kapalıyken üyeler sohbetteki geçmiş tablosunda yalnızca kendilerini görür."
          />
        </Section>
      </div>

      <Section Icon={Shield} title="Ekipler" hint="Üyeleri ekiplere ayır; her ekibin kendi okuma ve ceza kuralları olsun.">
        <Toggle checked={teamsEnabled} onChange={toggleTeams} title="Grubu ekiplere böl" desc="Katılanlar ekibini seçer; ekip değişikliği yönetici onayıyla olur." />
        {teamsEnabled && (
          <div className="space-y-2">
            {teams.map((t, i) => (
              <TeamCard
                key={t.key}
                team={t}
                index={i}
                canRemove={teams.length > 2}
                onChange={(nt) => setTeams((all) => all.map((x) => (x.key === t.key ? nt : x)))}
                onRemove={() => setTeams((all) => all.filter((x) => x.key !== t.key))}
              />
            ))}
            {teams.length < 20 && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setTeams((all) => [...all, newTeam(all.length)])}>
                <Plus /> Ekip ekle
              </button>
            )}
          </div>
        )}
      </Section>

      {!teamsEnabled && (
        <Section Icon={BookOpen} title="Okuma kuralları" hint="Önce ceza türünü seç, sonra hedefi ve cezayı belirle.">
          <RulesEditor value={rules} onChange={setRules} />
        </Section>
      )}

      <Section Icon={AlarmClock} title="Zamanlama" hint="Türkiye saati">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Gün başlar</label>
            <input type="time" required className="input h-12 text-lg font-semibold" value={minuteToTime(start)} onChange={(e) => setStart(timeToMinute(e.target.value) ?? start)} />
          </div>
          <div>
            <label className="label">Son bildirim {nextDay && <span className="text-primary">(ertesi gün)</span>}</label>
            <input type="time" required className="input h-12 text-lg font-semibold" value={minuteToTime(deadline)} onChange={(e) => setDeadline(timeToMinute(e.target.value) ?? deadline)} />
          </div>
        </div>
        <Timeline start={start} deadline={deadline} reminderHours={reminderHours} />
        <div>
          <p className="label">Son saatten önce uyarı</p>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 6, 12].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setReminderHours(h)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${h === reminderHours ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
              >
                {h === 0 ? "Kapalı" : `${h} saat`}
              </button>
            ))}
          </div>
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Her gün <b className="text-foreground">{minuteToTime(start)}</b>&apos;de başlar, {nextDay ? "ertesi gün " : ""}
          <b className="text-foreground">{minuteToTime(deadline)}</b>&apos;de kapanır.
          {reminderHours > 0 && ` ${reminderHours} saat önce uyarı,`} son 10 dakikada geri sayım bildirimi gelir.
        </p>
      </Section>

      <Section Icon={Landmark} title="Ceza ödemeleri" hint="Cezalar bu hesaba ödenir; yalnızca üyeler görür.">
        <div>
          <label className="label">IBAN</label>
          <input
            name="iban"
            className="input font-mono tracking-wide"
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            value={iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim()}
            onChange={(e) => setIban(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 26))}
          />
        </div>
        <div>
          <label className="label">Alıcı adı soyadı</label>
          <input name="ibanName" className="input" defaultValue={group?.ibanName} />
        </div>
      </Section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 rounded-xl bg-background/80 p-1 backdrop-blur">
        <SubmitButton className="btn-primary h-12 w-full text-base shadow-lg">{group ? "Ayarları kaydet" : "Grubu oluştur"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
