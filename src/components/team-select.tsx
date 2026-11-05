/** Ekipli gruplarda katılırken / değiştirirken ekip seçimi */
export function TeamSelect({ teams, defaultValue, name = "teamId" }: { teams: { id: string; name: string }[]; defaultValue?: string | null; name?: string }) {
  return (
    <select name={name} required defaultValue={defaultValue ?? ""} className="input">
      <option value="" disabled>
        Ekibini seç
      </option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
