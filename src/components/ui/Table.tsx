export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white sm:mx-0">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-2 py-2 text-left font-medium sm:px-3">
      {children}
    </th>
  );
}

export function Td({ children, colSpan, className }: { children?: React.ReactNode; colSpan?: number; className?: string }) {
  return (
    <td colSpan={colSpan} className={`border-b border-zinc-100 px-2 py-2 align-top sm:px-3 ${className ?? ""}`}>
      {children}
    </td>
  );
}
