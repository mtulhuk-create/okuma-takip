"use client";

import { useClerk } from "@clerk/nextjs";
import { Settings } from "lucide-react";

/** Clerk hesap ayarları (e-posta, şifre, bağlı hesaplar); avatar yerine düğme */
export function AccountButton() {
  const clerk = useClerk();
  return (
    <button className="btn-ghost btn-sm" onClick={() => clerk.openUserProfile()} aria-label="Hesap ayarları">
      <Settings /> Hesap
    </button>
  );
}
