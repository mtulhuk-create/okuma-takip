/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}
