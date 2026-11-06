/** Borç yanında gösterilen vade bilgisi (ek süre ve karar süresi dahil) */
export function dueView(d: { id: string; amount: number; dueAt: Date; status: string; originalDueAt: Date | null; extensions: number; decisionUntil: Date | null }) {
  return {
    id: d.id,
    amount: d.amount,
    dueAt: d.dueAt.toISOString(),
    status: d.status,
    originalDueAt: d.originalDueAt?.toISOString() ?? null,
    extensions: d.extensions,
    decisionUntil: d.decisionUntil?.toISOString() ?? null,
  };
}

export type DueView = ReturnType<typeof dueView>;
