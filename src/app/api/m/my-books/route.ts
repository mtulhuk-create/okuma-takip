// Grup kurarken öneri: kullanıcının üyesi olduğu gruplardaki eserler
import { withUser } from "@/lib/api";
import { myBooks } from "@/lib/book-links";

export const GET = withUser(async (user) => ({ books: await myBooks(user.id) }));
