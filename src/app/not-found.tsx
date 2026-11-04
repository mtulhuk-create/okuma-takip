import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl">📕</p>
      <h1 className="font-serif text-2xl font-bold">Sayfa bulunamadı</h1>
      <Link href="/panel" className="btn-primary">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
