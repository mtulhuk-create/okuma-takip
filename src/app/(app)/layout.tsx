import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { ScrollTop } from "@/components/scroll-top";
import { requireUser } from "@/lib/auth";
import { getBadgeCounts } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Ad soyad alınmamış kullanıcılar önce adını girer
  if (!user.nameConfirmed) redirect("/ad-soyad");
  const badge = await getBadgeCounts(user.id);
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-2xl px-4 pb-28">
      <ScrollTop />
      {children}
      <BottomNav unread={badge} />
    </div>
  );
}
