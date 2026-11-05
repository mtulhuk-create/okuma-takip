import { UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { NameForm } from "@/components/name-form";
import { requireUser, splitFullName } from "@/lib/auth";

export const metadata = { title: "Ad soyad" };

/** Ad soyad girilmemişse uygulamaya girmeden önce burası açılır; profilden düzenlemek için de kullanılır. */
export default async function FullNamePage({ searchParams }: { searchParams: Promise<{ duzenle?: string }> }) {
  const user = await requireUser();
  const edit = (await searchParams).duzenle === "1";
  if (user.nameConfirmed && !edit) redirect("/panel");
  const initial = splitFullName(user.name);
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserRound className="size-7" />
        </span>
        <h1 className="font-serif text-2xl font-bold">{edit ? "Ad soyadını düzenle" : "Seni tanıyalım"}</h1>
        <p className="text-sm text-muted-foreground">Grup arkadaşların seni sohbette, gün kartlarında ve okuma geçmişinde bu adla görecek.</p>
      </div>
      <NameForm firstName={initial.firstName} lastName={initial.lastName} next={edit ? "/profil" : "/panel"} canCancel={edit} />
    </main>
  );
}
