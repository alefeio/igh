import { Suspense, type ReactNode } from "react";

export default function CoordenacaoLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Carregando…</p>}>
      {children}
    </Suspense>
  );
}
