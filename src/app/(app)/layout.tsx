import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/auth";
import { getBadgeCounts } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const badge = await getBadgeCounts(user.id);
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-2xl px-4 pb-28">
      {children}
      <BottomNav unread={badge} />
    </div>
  );
}
