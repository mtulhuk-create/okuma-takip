import { SignOutButton, UserButton } from "@clerk/nextjs";
import { PushToggle } from "@/components/push-toggle";
import { requireUser } from "@/lib/auth";
import { getProfileStats } from "@/lib/queries";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const stats = await getProfileStats(user.id);
  return (
    <main className="space-y-5 pt-4">
      <header className="flex items-center gap-3">
        <UserButton />
        <div>
          <h1 className="font-serif text-2xl font-bold">{user.name}</h1>
          {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Toplam sayfa", stats.totalPages],
          ["Okunan gün", stats.readDays],
          ["Toplam ceza", `${stats.totalPenalty} TL`],
          ["Aktif grup", stats.activeGroups],
        ].map(([l, v]) => (
          <div key={l} className="card">
            <p className="label">{l}</p>
            <p className="text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <section className="card space-y-2">
        <h2 className="font-bold">🔔 Bildirimler</h2>
        <PushToggle />
        <p className="text-xs text-muted-foreground">
          Uyarılar grubun belirlediği saatte, geri sayım ise son bildirim saatinden 10 dakika önce başlar. Bildirimdeki butonlarla uygulamayı açmadan bildirim
          yapabilirsin.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Diğer kullanıcılar seni davet etmek için adınla ya da kullanıcı adınla arayabilir. Adını değiştirmek için sağ üstteki profil resmine dokun.
      </p>

      <SignOutButton redirectUrl="/">
        <button className="btn-ghost w-full text-destructive">Çıkış yap</button>
      </SignOutButton>
    </main>
  );
}
