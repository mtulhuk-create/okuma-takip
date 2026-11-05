type TeamOption = { id: string; name: string; targetPages?: number; minPages?: number };

/** Ekipli gruplarda katılırken / değiştirirken ekip seçimi (hedef bilgisiyle) */
export function TeamSelect({ teams, defaultValue, name = "teamId" }: { teams: TeamOption[]; defaultValue?: string | null; name?: string }) {
  return (
    <select name={name} required defaultValue={defaultValue ?? ""} className="input">
      <option value="" disabled>
        Ekibini seç
      </option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
          {t.targetPages != null ? ` · günde ${t.targetPages} sayfa${t.minPages ? ` (alt sınır ${t.minPages})` : ""}` : ""}
        </option>
      ))}
    </select>
  );
}
