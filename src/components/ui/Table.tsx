export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] sm:mx-0">
      <table className="min-w-full text-sm text-[var(--text-primary)]">{children}</table>
    </div>
  );
}

export function Th({ children, className, title }: { children?: React.ReactNode; className?: string; title?: string }) {
  return (
    <th title={title} className={`whitespace-nowrap border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-2 text-left font-medium sm:px-3 ${className ?? ""}`}>
      {children}
    </th>
  );
}

export function Td({ children, colSpan, className }: { children?: React.ReactNode; colSpan?: number; className?: string }) {
  return (
    <td colSpan={colSpan} className={`border-b border-[var(--card-border)] px-2 py-2 align-top sm:px-3 ${className ?? ""}`}>
      {children}
    </td>
  );
}
