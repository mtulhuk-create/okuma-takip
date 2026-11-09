import { auth } from "@clerk/nextjs/server";
import { AlarmClock, Coins, Target, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/panel");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        {/* Amblem: açık ve koyu temaya göre */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-light.png" alt="Okuma Takip" width={160} height={86} className="mx-auto mb-4 h-auto w-40 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-dark.png" alt="" aria-hidden width={160} height={86} className="mx-auto mb-4 hidden h-auto w-40 dark:block" />
        <h1 className="font-serif text-4xl font-bold">Okuma Takip</h1>
        <p className="mt-3 text-foreground/80">
          Arkadaşlarınla okuma grubu kur. Her gün sayfanı bildir. Hedefin altında kalırsan <b>ceza</b> öde!
        </p>
      </div>
      <ul className="space-y-3 text-sm">
        {[
          [Target, "Günlük sayfa hedefini sen belirle"],
          [Users, "Herkese açık ya da özel gruplar kur, sohbet et"],
          [AlarmClock, "Son saatten önce hatırlatma ve 10 dakikalık geri sayım"],
          [Coins, "Okumayana TL ceza, vadesinde ödemeyen gruptan çıkar"],
        ].map(([Icon, t]) => {
          const I = Icon as typeof Target;
          return (
            <li key={t as string} className="card flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <I className="size-5" />
              </span>
              {t as string}
            </li>
          );
        })}
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
