/* eslint-disable @next/next/no-img-element */
const COLORS = ["bg-rose-100 text-rose-800", "bg-amber-100 text-amber-800", "bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-orange-100 text-orange-800"];

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({ name, src, size = 36, ring = false }: { name: string; src?: string | null; size?: number; ring?: boolean }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const cls = `shrink-0 rounded-full ${ring ? "ring-2 ring-card" : ""}`;
  return src ? (
    <img src={src} alt={name} width={size} height={size} loading="lazy" className={`${cls} object-cover`} style={{ width: size, height: size }} />
  ) : (
    <span className={`${cls} inline-flex items-center justify-center font-bold ${colorFor(name)}`} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

/** Üst üste binmiş profil resimleri */
export function AvatarStack({ people, size = 28, max = 5 }: { people: { id: string; name: string; imageUrl: string | null }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} className={i > 0 ? "-ml-2" : ""}>
          <Avatar name={p.name} src={p.imageUrl} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span className="-ml-2 inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-card" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
