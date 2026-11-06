"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { saveFullName } from "@/app/actions";
import { SubmitButton } from "./action-form";

export function NameForm({ name, next, canCancel }: { name: string; next: string; canCancel?: boolean }) {
  const router = useRouter();
  const [state, action] = useActionState(saveFullName, null);
  useEffect(() => {
    if (state?.ok) router.replace(next);
  }, [state, next, router]);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label htmlFor="name" className="label">
          Kullanmak istediğiniz adınız
        </label>
        <input id="name" name="name" className="input" defaultValue={name} autoComplete="name" autoCapitalize="words" required minLength={2} maxLength={60} autoFocus />
      </div>
      {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        {canCancel && (
          <Link href={next} className="btn-ghost flex-1">
            Vazgeç
          </Link>
        )}
        <SubmitButton className="btn-primary flex-1">
          <Check /> Kaydet
        </SubmitButton>
      </div>
    </form>
  );
}
