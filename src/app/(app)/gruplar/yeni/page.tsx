import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GroupForm } from "@/components/group-form";

export const metadata = { title: "Grup oluştur" };

export default function NewGroupPage() {
  return (
    <main className="space-y-4 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/gruplar" className="btn-icon -ml-2" aria-label="Geri">
          <ArrowLeft />
        </Link>
        <h1 className="font-serif text-xl font-bold">Yeni okuma grubu</h1>
      </div>
      <GroupForm />
    </main>
  );
}
