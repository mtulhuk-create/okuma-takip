import { BottomNav } from "@/components/bottom-nav";
import { NativeBridge } from "@/components/native-bridge";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = getDb();
  const [unread, invites] = await Promise.all([
    db.notification.count({ where: { userId: user.id, read: false } }),
    db.invitation.count({ where: { inviteeId: user.id, status: "PENDING" } }),
  ]);
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-2xl px-4 pb-28">
      <NativeBridge />
      {children}
      <BottomNav unread={unread + invites} />
    </div>
  );
}
