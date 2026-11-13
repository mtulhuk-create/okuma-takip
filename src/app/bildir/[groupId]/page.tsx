import { BookOpen } from "lucide-react";
import { getDb } from "@/lib/db";
import { rulesFor } from "@/lib/rules";
import { verifyQuickToken } from "@/lib/token";
import { QuickReport } from "./quick-report";

export const metadata = { title: "Okuma bildir" };

export default async function QuickReportPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  // Saat hesabıyla okuyan için süre seçimi gösterilir
  const tok = t ? await verifyQuickToken(t).catch(() => null) : null;
  const member = tok ? await getDb().groupMember.findUnique({ where: { groupId_userId: { groupId: tok.groupId, userId: tok.userId } }, include: { group: { include: { teams: true } } } }) : null;
  const unit = member ? rulesFor(member.group, member).readUnit : "PAGES";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BookOpen className="size-7" />
        </span>
        <h1 className="mt-2 font-serif text-2xl font-bold">Bugün ne kadar okudun?</h1>
      </div>
      {t ? <QuickReport token={t} unit={unit} /> : <p className="text-center text-destructive">Geçersiz bağlantı.</p>}
    </main>
  );
}
