// Menü rozeti: okunmamış mesajı olan grup sayısı (hafif istek; sayfa değiştikçe tazelenir)
import { withUser } from "@/lib/api";
import { unreadGroupCount } from "@/lib/unread";

export const dynamic = "force-dynamic";

export const GET = withUser(async (user) => ({ groups: await unreadGroupCount(user.id) }));
