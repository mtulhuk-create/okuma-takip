"use client";

import { Bell, BookOpen, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/panel", label: "Bugün", Icon: BookOpen },
  { href: "/gruplar", label: "Gruplar", Icon: Users },
  { href: "/bildirimler", label: "Bildirimler", Icon: Bell },
  { href: "/profil", label: "Profil", Icon: User },
];

// Sohbet ekranı tam ekrandır; alt menü gizlenir
const CHAT = /^\/gruplar\/(?!yeni$)[^/]+$/;

export function BottomNav({ unread, unreadGroups: initialGroups = 0 }: { unread: number; unreadGroups?: number }) {
  const pathname = usePathname();
  // Okunmamış mesajı olan grup sayısı: sayfa değiştikçe (ör. sohbetten çıkınca) ve sekmeye dönünce tazelenir
  const [unreadGroups, setUnreadGroups] = useState(initialGroups);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/m/unread", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { groups?: number } | null) => alive && d && setUnreadGroups(d.groups ?? 0))
        .catch(() => {});
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(onVisible, 60_000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
    };
  }, [pathname]);
  // Bildirimler açılınca rozet hemen sıfırlanır (sunucu da okundu işaretler); yeni bildirim gelirse yeniden görünür
  const onNotes = pathname.startsWith("/bildirimler");
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    if (onNotes) setSeen(unread);
  }, [onNotes, unread]);
  const badge = onNotes || unread === seen ? 0 : unread;
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
                {/* Okunmamış mesajı olan grup sayısı */}
                {href === "/gruplar" && unreadGroups > 0 && (
                  <span className="absolute left-1/2 top-1.5 ml-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
                    {unreadGroups > 99 ? "99+" : unreadGroups}
                  </span>
                )}
                {href === "/bildirimler" && badge > 0 && (
                  <span className="absolute left-1/2 top-1.5 ml-2 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-white">
                    {badge > 99 ? "99+" : badge}
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
