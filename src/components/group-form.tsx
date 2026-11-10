"use client";

import type { Group, Team } from "@prisma/client";
import { AlarmClock, AtSign, BookOpen, ChevronDown, Globe, Landmark, Lock, PencilLine, Plus, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { createGroup, updateGroup } from "@/app/actions";
import { pickRules, type Rules } from "@/lib/rules";
import { minuteToTime, periodLengthMinutes, timeToMinute } from "@/lib/schedule";
import { BookSuggestProvider } from "./book-suggest";
import { ActionForm, SubmitButton } from "./action-form";
import { RulesEditor, Tiles } from "./rules-editor";

/**
 * Ayar bölümü: başlıkta güncel ayarın özeti. Düzenlemede kapalı başlar (dokununca açılır);
 * grup kurarken açık gelir. İçerik kapalıyken de formda kalır.
 */
function Section({ Icon, title, hint, summary, collapsible, children }: { Icon: typeof Lock; title: string; hint?: string; summary?: string; collapsible?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <section className="card overflow-hidden p-0">
      <button type="button" onClick={() => collapsible && setOpen((o) => !o)} className={`flex w-full items-center gap-3 p-4 text-left ${collapsible ? "hover:bg-muted/40" : "cursor-default"}`} aria-expanded={open}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-tight">{title}</span>
          {open ? hint && <span className="block text-xs text-muted-foreground">{hint}</span> : summary && <span className="block truncate text-xs text-muted-foreground">{summary}</span>}
        </span>
        {collapsible && <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      <div className={open ? "space-y-4 border-t border-border p-4" : "hidden"}>{children}</div>
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
const DEFAULT_RULES: Rules = { penaltyMode: "FIXED", targetPages: 20, minPages: 10, penaltyAmount: 20, minDiscount: 50, books: [{ id: "kitap1", title: "Risale-i Nur Külliyatı", targetPages: 20, minPages: 10 }] };

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

/** Türkçe belirtme eki: 1'i, 2'si, 6'sı, 9'u, 10'u, 20'si */
function dayWithSuffix(n: number) {
  const last = n % 10;
  const s = last ? { 1: "i", 2: "si", 3: "ü", 4: "ü", 5: "i", 6: "sı", 7: "si", 8: "i", 9: "u" }[last] : { 10: "u", 20: "si", 30: "u" }[n] ?? "i";
  return `${n}'${s}`;
}
/** Varsayılan vade: 0 ayın son günü, 1–28 ertesi ayın o günü (eski ayarlarda negatif: ay sonundan önce) */
const dueOffsetText = (d: number) => (d === 0 ? "Her ayın son günü" : d < 0 ? `Ay sonundan ${-d} gün önce` : `Ertesi ayın ${dayWithSuffix(d)}`);

const BADGE_WARNING =
  "Rozetler gruba latife olsun diye konulmuş bir özelliktir.\n\nÜyeler rozet adı önerirken aşırıya kaçabilir ya da rozet verilen kişi konulan lakaba alınabilir. Uygunsuz şıkları ve rozetleri yönetici olarak kaldırabilirsin.\n\nRozetleri açmak istiyor musun?";

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
  const [dueOffset, setDueOffset] = useState(group?.dueOffsetDays ?? 0);
  const [kickOnExpire, setKickOnExpire] = useState(group?.kickOnExpire ?? true);
  const [nameDisplay, setNameDisplay] = useState<"ENTERED" | "ACCOUNT" | "BOTH">(group?.nameDisplay ?? "ENTERED");
  const [badgesEnabled, setBadgesEnabled] = useState(group?.badgesEnabled ?? false);
  const edit = !!group;
  // Kaydedilmemiş değişiklik: seçimlerin ilk halinden farkı ya da metin alanlarına yazılması
  const snapshot = JSON.stringify([visibility, chatPolicy, shareProgress, rules, teamsEnabled, teams, start, deadline, reminderHours, iban, dueOffset, kickOnExpire, nameDisplay, badgesEnabled]);
  const [saved, setSaved] = useState(snapshot);
  const [typed, setTyped] = useState(false);
  const dirty = typed || snapshot !== saved;

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
    <ActionForm
      action={group ? updateGroup : createGroup}
      className="space-y-3"
      onSuccess={() => {
        setSaved(snapshot);
        setTyped(false);
      }}
    >
      <BookSuggestProvider enabled={!group}>
      <div className="space-y-3" onInputCapture={(e) => (e.target as HTMLElement).tagName !== "SELECT" && setTyped(true)}>
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
      <input type="hidden" name="dueOffsetDays" value={dueOffset} />
      <input type="hidden" name="kickOnExpire" value={kickOnExpire ? "1" : "0"} />
      <input type="hidden" name="nameDisplay" value={nameDisplay} />
      <input type="hidden" name="badgesEnabled" value={badgesEnabled ? "1" : "0"} />

      <Section Icon={PencilLine} title="Genel" summary={`${group?.name ?? ""} · ${visibility === "PUBLIC" ? "Herkese açık" : "Özel"}`} collapsible={edit}>
        <div>
          <label className="label">Grup adı</label>
          <input name="name" required minLength={3} maxLength={80} className="input" defaultValue={group?.name} placeholder="Örn. Sabah Okurları" />
        </div>
        <div>
          <label className="label">Açıklama (isteğe bağlı)</label>
          <textarea name="description" maxLength={500} rows={2} className="input" defaultValue={group?.description ?? ""} placeholder="Grubun amacı, okuma düzeni..." />
        </div>
        <div>
          <p className="label">Kimler katılabilir?</p>
          <Tiles
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "PRIVATE", Icon: Lock, title: "Özel", desc: "Yalnızca davetle" },
              { value: "PUBLIC", Icon: Globe, title: "Herkese açık", desc: "Listede görünür, istek alınır" },
            ]}
          />
        </div>
      </Section>

      <Section
        Icon={BookOpen}
        title="Okuma ve ceza kuralları"
        hint="Eserleri, günlük hedefi ve cezayı belirle. İstersen grubu ekiplere ayır."
        summary={teamsEnabled ? `${teams.length} ekip · her ekibin kendi kuralı` : `${rules.books.map((b) => b.title).join(", ")} · günde ${rules.targetPages} sf · ${rules.penaltyMode === "FIXED" ? `${rules.penaltyAmount} TL/gün` : `${rules.penaltyAmount} TL/sayfa`}`}
        collapsible={edit}
      >
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
        {!teamsEnabled && <RulesEditor value={rules} onChange={setRules} />}
      </Section>

      <Section
        Icon={AlarmClock}
        title="Zamanlama"
        hint="Türkiye saati"
        summary={`${minuteToTime(start)} – ${nextDay ? "ertesi gün " : ""}${minuteToTime(deadline)}${reminderHours ? ` · ${reminderHours} sa önce uyarı` : " · uyarı kapalı"}`}
        collapsible={edit}
      >
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

      <Section
        Icon={ShieldCheck}
        title="Sohbet ve üyeler"
        summary={`${chatPolicy === "ALL" ? "Herkes yazar" : "Yalnızca yöneticiler yazar"} · ${{ ENTERED: "Yazdığı ad", ACCOUNT: "Hesap adı", BOTH: "Ad + hesap adı" }[nameDisplay]} · geçmiş ${shareProgress ? "açık" : "gizli"} · rozetler ${badgesEnabled ? "açık" : "kapalı"}`}
        collapsible={edit}
      >
        <div>
          <p className="label">Kimler yazabilir?</p>
          <Tiles
            value={chatPolicy}
            onChange={setChatPolicy}
            options={[
              { value: "ALL", Icon: Users, title: "Tüm üyeler", desc: "Herkes mesaj ve anket atar" },
              { value: "ADMINS", Icon: ShieldCheck, title: "Yöneticiler", desc: "Üyeler yalnızca okur" },
            ]}
          />
        </div>
        <div>
          <p className="label">Okuyucuların adı nasıl görünsün?</p>
          <Tiles
            value={nameDisplay}
            onChange={setNameDisplay}
            options={[
              { value: "ENTERED", Icon: UserRound, title: "Yazdığı ad", desc: "Pencerede yazdığı ad" },
              { value: "ACCOUNT", Icon: AtSign, title: "Hesap adı", desc: "Google / e-posta hesabındaki ad" },
              { value: "BOTH", Icon: Users, title: "İkisi", desc: "İlk kelimeleri: Ahmet Sinan" },
            ]}
          />
        </div>
        <Toggle
          checked={shareProgress}
          onChange={setShareProgress}
          title="Okuyucular birbirinin geçmişini görsün"
          desc="Kapalıyken üyeler sohbetteki geçmiş tablosunda yalnızca kendilerini görür."
        />
        <Toggle
          checked={badgesEnabled}
          onChange={(on) => {
            if (on && !confirm(BADGE_WARNING)) return;
            setBadgesEnabled(on);
          }}
          title="Latife rozetleri"
          desc="7 gün üst üste tam okuyana Maşallah rozeti; 7 gün tam okuyamayana adını üyelerin oyladığı rozet. 2 gün içinde durum değişirse kalkar."
        />
      </Section>

      <Section
        Icon={Landmark}
        title="Kasa ve ödemeler"
        hint="Cezalar grubun kasasında toplanır; yönetici de herkes gibi okur ve ceza öder. Yalnızca üyeler görür."
        summary={`${iban ? "IBAN girildi" : "IBAN yok"} · ${dueOffsetText(dueOffset).toLocaleLowerCase("tr-TR")} · ${kickOnExpire ? "ödemeyen çıkarılır" : "ödemeyen çıkarılmaz"}`}
        collapsible={edit}
      >
        <div>
          <label className="label">Grup kasası IBAN</label>
          <input
            name="iban"
            className="input font-mono tracking-wide"
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            value={iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim()}
            onChange={(e) => setIban(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 26))}
          />
        </div>
        <div>
          <label className="label">Hesap sahibi adı soyadı</label>
          <input name="ibanName" className="input" defaultValue={group?.ibanName} />
        </div>
        <div>
          <label className="label">Varsayılan ödeme vadesi</label>
          {/* Ay sonu ya da ertesi ayın bir günü (ay sonundan önce/sonra gün saymak kafa karıştırıyordu) */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { on: dueOffset <= 0, label: "Ayın son günü", set: () => setDueOffset(0) },
              { on: dueOffset > 0, label: "Ertesi ayın bir günü", set: () => setDueOffset((d) => (d > 0 ? d : 5)) },
            ].map((o) => (
              <button key={o.label} type="button" onClick={o.set} className={`h-9 rounded-lg border text-xs font-semibold ${o.on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                {o.label}
              </button>
            ))}
          </div>
          {dueOffset > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className="btn-ghost size-9 p-0 text-lg" onClick={() => setDueOffset((d) => Math.max(1, d - 1))} aria-label="Bir gün öne al">
                −
              </button>
              <p className="flex-1 rounded-lg border border-border bg-card py-1.5 text-center text-sm font-semibold">Ertesi ayın {dayWithSuffix(dueOffset)}</p>
              <button type="button" className="btn-ghost size-9 p-0 text-lg" onClick={() => setDueOffset((d) => Math.min(28, d + 1))} aria-label="Bir gün ertele">
                +
              </button>
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {dueOffsetText(dueOffset)} · vade verirken bu tarih önerilir, istersen değiştirirsin. Ayın cezaları bu tarihe kadar ödenir.
          </p>
        </div>
        <Toggle
          checked={kickOnExpire}
          onChange={setKickOnExpire}
          title="Vadesinde ödemeyen gruptan çıkarılsın"
          desc="Vade dolunca önce sana sorulur: ek süre ver, indirim yap ya da çıkar. 24 saat içinde karar vermezsen çıkarılır. Kapalıysa borç açık kalır."
        />
      </Section>

      </div>
      {/* Sabit kaydet çubuğu: değişiklik varsa belirgin */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 flex items-center gap-3 rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
        <p className={`min-w-0 flex-1 truncate pl-1 text-xs ${dirty ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
          {edit ? (dirty ? "Kaydedilmemiş değişiklikler var" : "Tüm değişiklikler kaydedildi") : "Bilgileri kontrol edip grubu oluştur"}
        </p>
        <SubmitButton className={`btn-primary h-11 shrink-0 px-5 ${edit && !dirty ? "opacity-60" : ""}`}>{group ? "Kaydet" : "Grubu oluştur"}</SubmitButton>
      </div>
      </BookSuggestProvider>
    </ActionForm>
  );
}
