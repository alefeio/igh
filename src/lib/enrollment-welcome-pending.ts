/** Quem a listagem marca como «E-mail pendente» e o envio em lote deve alcançar. */
export function enrollmentNeedsWelcomeEmail(
  row: {
    id: string;
    status: string;
    email: string | null | undefined;
    studentDeleted: boolean;
  },
  alreadySent: ReadonlySet<string>,
): boolean {
  if (row.studentDeleted) return false;
  if (row.status !== "ACTIVE" && row.status !== "SUSPENDED") return false;
  if (!row.email?.trim()) return false;
  return !alreadySent.has(row.id);
}
