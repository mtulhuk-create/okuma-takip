import type { Group } from "@prisma/client";
import { createGroup, updateGroup } from "@/app/actions";
import { minuteToTime } from "@/lib/schedule";
import { ActionForm, SubmitButton } from "./action-form";

export function GroupForm({ group }: { group?: Group }) {
  return (
    <ActionForm action={group ? updateGroup : createGroup} className="space-y-4">
      {group && <input type="hidden" name="groupId" value={group.id} />}
      <div>
        <label className="label">Grup adı</label>
        <input name="name" required minLength={3} maxLength={80} className="input" defaultValue={group?.name} placeholder="Örn. Sabah Okurları" />
      </div>
      <div>
        <label className="label">Açıklama</label>
        <textarea name="description" maxLength={500} rows={2} className="input" defaultValue={group?.description ?? ""} />
      </div>
      <div>
        <label className="label">Görünürlük</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["PRIVATE", "🔒 Özel", "Sadece davetle katılınır"],
            ["PUBLIC", "🌍 Herkese açık", "Gruplar sayfasında görünür, katılım isteği alınır"],
          ].map(([v, t, d]) => (
            <label key={v} className="card flex cursor-pointer gap-2 p-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring/30">
              <input type="radio" name="visibility" value={v} defaultChecked={(group?.visibility ?? "PRIVATE") === v} className="mt-1 accent-primary" />
              <span>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="block text-xs text-muted-foreground">{d}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-sm font-bold">📖 Okuma kuralları</legend>
        <div>
          <label className="label">Günlük en az sayfa (alt sınır)</label>
          <input name="minPages" type="number" min={1} max={1000} required className="input" defaultValue={group?.minPages ?? 10} />
          <p className="mt-1 text-xs text-muted-foreground">Her üye kendi günlük hedefini belirler; bu değerin altına inemez.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Ceza türü</label>
            <select name="penaltyMode" className="input" defaultValue={group?.penaltyMode ?? "FIXED"}>
              <option value="FIXED">Gün başına sabit</option>
              <option value="PER_PAGE">Eksik sayfa başına</option>
            </select>
          </div>
          <div>
            <label className="label">Ceza tutarı (TL)</label>
            <input name="penaltyAmount" type="number" min={0} max={100000} required className="input" defaultValue={group?.penaltyAmount ?? 20} />
          </div>
        </div>
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-sm font-bold">⏰ Zamanlama (Türkiye saati)</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Yeni okuma günü başlangıcı</label>
            <input name="startTime" type="time" required className="input" defaultValue={minuteToTime(group?.startMinute ?? 0)} />
          </div>
          <div>
            <label className="label">Son bildirim saati</label>
            <input name="deadlineTime" type="time" required className="input" defaultValue={minuteToTime(group?.deadlineMinute ?? 1439)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Son saat başlangıçtan önceyse ertesi güne sayılır (örn. 06:00 başlangıç, 02:00 bitiş).</p>
        <div>
          <label className="label">Son saatten kaç saat önce uyarı gönderilsin?</label>
          <input name="reminderHours" type="number" min={0} max={23} required className="input" defaultValue={group?.reminderHours ?? 2} />
          <p className="mt-1 text-xs text-muted-foreground">0 = uyarı yok. Son 10 dakikada geri sayım bildirimi her zaman gönderilir.</p>
        </div>
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-sm font-bold">💳 Ceza ödemeleri</legend>
        <div>
          <label className="label">IBAN</label>
          <input name="iban" className="input font-mono" placeholder="TR00 0000 0000 0000 0000 0000 00" defaultValue={group?.iban} />
        </div>
        <div>
          <label className="label">Alıcı adı soyadı</label>
          <input name="ibanName" className="input" defaultValue={group?.ibanName} />
        </div>
      </fieldset>

      <SubmitButton className="btn-primary w-full py-3">{group ? "Ayarları kaydet" : "Grubu oluştur"}</SubmitButton>
    </ActionForm>
  );
}
