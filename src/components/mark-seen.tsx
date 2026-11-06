"use client";

import { useEffect } from "react";
import { markNotificationsSeen } from "@/app/actions";

export function MarkSeen() {
  useEffect(() => {
    markNotificationsSeen().catch(() => {});
  }, []);
  return null;
}
