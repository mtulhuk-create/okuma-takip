"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
};

export function ActionForm({ action, children, className, confirm, resetOnSuccess, onSuccess }: Props) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && <p className="mt-2 w-full basis-full text-sm font-medium text-destructive">{state.error}</p>}
      {state?.ok && state.message && <p className="mt-2 w-full basis-full text-sm font-medium text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function SubmitButton({
  children,
  className = "btn-primary",
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className}>
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
