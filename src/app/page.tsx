import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/panel");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="Okuma Takip" width={96} height={96} className="mx-auto mb-4 rounded-3xl shadow-lg" />
        <h1 className="font-serif text-4xl font-bold">Okuma Takip</h1>
        <p className="mt-3 text-foreground/80">
          Arkadaşlarınla okuma grubu kur. Her gün sayfanı bildir. Hedefin altında kalırsan <b>ceza</b> öde!
        </p>
      </div>
      <ul className="space-y-3 text-sm">
        {[
          ["🎯", "Günlük sayfa hedefini sen belirle"],
          ["👥", "Herkese açık ya da özel gruplar kur, davet et"],
          ["⏰", "Son saatten önce hatırlatma ve 10 dakikalık geri sayım"],
          ["💸", "Okumayana TL cinsinden ceza, vadesinde ödemeyen gruptan çıkar"],
        ].map(([i, t]) => (
          <li key={t} className="card flex items-center gap-3">
            <span className="text-2xl">{i}</span>
            {t}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        <Link href="/sign-up" className="btn-primary py-3 text-base">
          Hemen başla
        </Link>
        <Link href="/sign-in" className="btn-ghost py-3 text-base">
          Giriş yap
        </Link>
      </div>
    </main>
  );
}
