"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/panel", label: "Bugün", icon: "📖" },
  { href: "/gruplar", label: "Gruplar", icon: "👥" },
  { href: "/bildirimler", label: "Bildirimler", icon: "🔔" },
  { href: "/profil", label: "Profil", icon: "👤" },
];

export function BottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <span className="text-xl leading-none">{it.icon}</span>
                {it.label}
                {it.href === "/bildirimler" && unread > 0 && (
                  <span className="absolute right-1/2 top-1 translate-x-5 rounded-full bg-destructive px-1.5 text-[10px] text-white">{unread}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
