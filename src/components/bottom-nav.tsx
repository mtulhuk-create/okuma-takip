"use client";

import { Bell, BookOpen, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/panel", label: "Bugün", Icon: BookOpen },
  { href: "/gruplar", label: "Gruplar", Icon: Users },
  { href: "/bildirimler", label: "Bildirimler", Icon: Bell },
  { href: "/profil", label: "Profil", Icon: User },
];

// Sohbet ekranı tam ekrandır; alt menü gizlenir
const CHAT = /^\/gruplar\/(?!yeni$)[^/]+$/;

export function BottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  if (CHAT.test(pathname)) return null;
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg">
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-primary/10" : ""}`}>
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
                {href === "/bildirimler" && unread > 0 && (
                  <span className="absolute left-1/2 top-1.5 ml-2 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
