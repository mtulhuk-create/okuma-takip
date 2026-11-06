"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Her sayfaya girişte en üstten başla (geri tuşuyla dönülse de) */
export function ScrollTop() {
  const pathname = usePathname();
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
