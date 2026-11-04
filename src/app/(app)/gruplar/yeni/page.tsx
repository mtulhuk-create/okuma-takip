import Link from "next/link";
import { GroupForm } from "@/components/group-form";

export const metadata = { title: "Grup oluştur" };

export default function NewGroupPage() {
  return (
    <main className="space-y-4 pt-4">
      <Link href="/gruplar" className="text-sm text-muted-foreground">
        ← Gruplar
      </Link>
      <h1 className="font-serif text-2xl font-bold">Yeni okuma grubu</h1>
      <GroupForm />
    </main>
  );
}
