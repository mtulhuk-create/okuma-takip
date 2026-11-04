"use client";

import { useEffect, useState } from "react";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export function Countdown({ to, label = "kaldı", className = "" }: { to: string; label?: string; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className={className}>--:--</span>;
  const left = target - now;
  const urgent = left < 10 * 60_000;
  return (
    <span className={`${className} tabular-nums ${urgent ? "text-destructive animate-pulse" : ""}`}>
      {left > 0 ? `${fmt(left)} ${label}` : "süre doldu"}
    </span>
  );
}
