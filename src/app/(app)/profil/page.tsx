import { SignOutButton, UserButton } from "@clerk/nextjs";
import { Bell, BookOpen, CalendarCheck, LogOut, Palette, Pencil, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { PushToggle } from "@/components/push-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { getProfileStats } from "@/lib/queries";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const stats = await getProfileStats(user.id);
  const items = [
    { Icon: BookOpen, label: "Toplam sayfa", value: stats.totalPages },
    { Icon: CalendarCheck, label: "Okunan gün", value: stats.readDays },
    { Icon: Wallet, label: "Toplam ceza", value: `${stats.totalPenalty} TL` },
    { Icon: Users, label: "Aktif grup", value: stats.activeGroups },
  ];
  return (
    <main className="space-y-5 pt-4">
      <header className="flex items-center gap-3">
        <UserButton appearance={{ elements: { avatarBox: { width: 52, height: 52 } } }} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl font-bold">{user.name}</h1>
          {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
        </div>
        <Link href="/ad-soyad?duzenle=1" className="btn-ghost btn-sm" aria-label="Adını düzenle">
          <Pencil /> Düzenle
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {items.map(({ Icon, label, value }) => (
          <div key={label} className="card">
            <Icon className="mb-2 size-5 text-primary" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Palette className="size-4 text-primary" /> Tema
            </span>
            <span className="block text-xs text-muted-foreground">Varsayılan: cihazın sistem ayarı</span>
          </span>
          <ThemeToggle />
        </div>
        <div className="border-t border-border pt-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Bell className="size-4 text-primary" /> Bildirimler
          </p>
          <PushToggle />
          <p className="mt-2 text-xs text-muted-foreground">Uyarı grubun belirlediği saatte, geri sayım son 10 dakikada gelir. Butonlarla uygulamayı açmadan bildirebilirsin.</p>
        </div>
      </section>

      <SignOutButton redirectUrl="/">
        <button className="btn-quiet w-full text-destructive">
          <LogOut /> Çıkış yap
        </button>
      </SignOutButton>
    </main>
  );
}
