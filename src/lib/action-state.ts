import { unstable_rethrow } from "next/navigation";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message || undefined };
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export function str(fd: FormData, key: string, max = 500) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export function int(fd: FormData, key: string, min: number, max: number, label: string) {
  const n = Number(fd.get(key));
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} ${min}-${max} arasında bir tam sayı olmalı`);
  return n;
}
