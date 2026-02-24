export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-medium">
      {children}
    </th>
  );
}

export function Td({ children }: { children?: React.ReactNode }) {
  return <td className="border-b border-zinc-100 px-3 py-2 align-top">{children}</td>;
}
