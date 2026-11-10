/* eslint-disable @next/next/no-img-element */
import { AVATAR_FRAME, TIER_LABEL, type Tier } from "./tier";
// Her kişiye sabit bir renk: açık modda açık, koyu modda koyu tonlar
const COLORS = [
  "bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-100",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-100",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-100",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/80 dark:text-sky-100",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/80 dark:text-violet-100",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/80 dark:text-orange-100",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/80 dark:text-teal-100",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/80 dark:text-fuchsia-100",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/80 dark:text-lime-100",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-100",
];

function colorFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Clerk'in fotoğrafsız kullanıcılara verdiği varsayılan resim ({"type":"default"...}) gerçek fotoğraf sayılmaz */
export function isRealPhoto(src?: string | null): src is string {
  return !!src && !src.includes("eyJ0eXBlIjoiZGVmYXVsdCI");
}

/**
 * Profil resmi: mail hesabından gelen fotoğraf varsa o; yoksa kişiye özel renkte,
 * hesap (mail) adının baş harfiyle sistem avatarı.
 */
export function Avatar({ name, src, size = 36, ring = false, initial, seed, frame }: { name: string; src?: string | null; size?: number; ring?: boolean; initial?: string; seed?: string; frame?: Tier | null }) {
  const letter = (initial || name.trim().match(/\p{L}|\d/u)?.[0] || "?").toLocaleUpperCase("tr-TR");
  // Ekip çerçevesi (altın / gümüş / bronz) üst üste dizilimdeki ayırıcı halkanın yerine geçer
  const cls = `shrink-0 rounded-full ${frame ? AVATAR_FRAME[frame] : ring ? "ring-2 ring-card" : ""}`;
  return isRealPhoto(src) ? (
    <img src={src} alt={name} title={frame ? TIER_LABEL[frame] : undefined} width={size} height={size} loading="lazy" className={`${cls} object-cover`} style={{ width: size, height: size }} />
  ) : (
    <span className={`${cls} inline-flex items-center justify-center font-serif font-bold ${colorFor(seed || name)}`} style={{ width: size, height: size, fontSize: size * 0.44 }} aria-label={name} title={frame ? TIER_LABEL[frame] : undefined}>
      {letter}
    </span>
  );
}

/** Üst üste binmiş profil resimleri */
export function AvatarStack({ people, size = 28, max = 5 }: { people: { id: string; name: string; imageUrl: string | null; initial?: string; tier?: Tier }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} className={i > 0 ? "-ml-2" : ""}>
          <Avatar name={p.name} src={p.imageUrl} initial={p.initial} seed={p.id} size={size} ring frame={p.tier} />
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
