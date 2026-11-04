import { SignOutButton, UserButton } from "@clerk/nextjs";
import { PushToggle } from "@/components/push-toggle";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const db = getDb();
  const [pages, days, penalties, groups] = await Promise.all([
    db.readingLog.aggregate({ where: { userId: user.id }, _sum: { pages: true } }),
    db.readingLog.count({ where: { userId: user.id, pages: { gt: 0 } } }),
    db.penalty.aggregate({ where: { userId: user.id, status: { in: ["PAID", "UNPAID", "IN_DUE"] } }, _sum: { amount: true } }),
    db.groupMember.count({ where: { userId: user.id, status: "ACTIVE" } }),
  ]);
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
          ["Toplam sayfa", pages._sum.pages ?? 0],
          ["Okunan gün", days],
          ["Toplam ceza", `${penalties._sum.amount ?? 0} TL`],
          ["Aktif grup", groups],
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
