import { QuickReport } from "./quick-report";

export const metadata = { title: "Okuma bildir" };

export default async function QuickReportPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-5xl">📖</p>
        <h1 className="mt-2 font-serif text-2xl font-bold">Bugün ne kadar okudun?</h1>
      </div>
      {t ? <QuickReport token={t} /> : <p className="text-center text-destructive">Geçersiz bağlantı.</p>}
    </main>
  );
}
