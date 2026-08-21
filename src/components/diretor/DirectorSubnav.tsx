"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/diretor", label: "Visão Geral", group: "Direção" },
  { href: "/diretor/prioridades", label: "Prioridades", group: "Direção" },
  { href: "/diretor/academico", label: "Acadêmico", group: "Desempenho" },
  { href: "/diretor/oferta-territorios", label: "Oferta e Territórios", group: "Desempenho" },
  { href: "/diretor/guia", label: "Guia do Diretor", group: "Documentos" },
] as const;

export function DirectorSubnav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  const suffix = qs ? `?${qs}` : "";

  const groups = ["Direção", "Desempenho", "Documentos"] as const;

  return (
    <nav aria-label="Área do Diretor" className="mb-6 border-b border-[var(--card-border)] pb-3">
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const items = NAV.filter((i) => i.group === group);
          return (
            <div key={group}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {group}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const active =
                    item.href === "/diretor"
                      ? pathname === "/diretor"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={`${item.href}${suffix}`}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                          active
                            ? "bg-[var(--igh-primary)] text-white"
                            : "bg-[var(--igh-surface)] text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 border border-[var(--card-border)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Área somente leitura. Páginas financeira, administrativa e de impacto completas entram na Fase 1B.
        {" · "}
        <Link href="/dashboard" className="underline hover:text-[var(--igh-primary)]">
          Dashboard legado (fallback)
        </Link>
      </p>
    </nav>
  );
}
