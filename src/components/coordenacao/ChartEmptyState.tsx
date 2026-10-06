export function ChartEmptyState({
  title = "Ainda sem dados para este gráfico",
  description = "Quando houver informações no ciclo e nos filtros escolhidos, o gráfico aparece aqui.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/40 px-4 py-8 text-center">
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  );
}
