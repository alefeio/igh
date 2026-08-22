"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/diretor", label: "Visão Geral", group: "Direção" },
  { href: "/diretor/prioridades", label: "Prioridades", group: "Direção" },
  { href: "/diretor/academico", label: "Acadêmico", group: "Desempenho" },
  { href: "/diretor/oferta-territorios", label: "Oferta e Territórios", group: "Desempenho" },
  { href: "/diretor/impacto-social", label: "Impacto Social", group: "Desempenho" },
  { href: "/diretor/financeiro", label: "Financeiro", group: "Gestão" },
  { href: "/diretor/projetos-convenios", label: "Projetos e Convênios", group: "Gestão" },
  { href: "/diretor/administrativo", label: "Administrativo", group: "Gestão" },
  { href: "/diretor/relatorios", label: "Relatórios", group: "Documentos" },
  { href: "/diretor/guia", label: "Guia do Diretor", group: "Documentos" },
] as const;

function suffixFor(href: string, search: URLSearchParams): string {
  const sp = new URLSearchParams();
  const cyclePaths = ["/diretor", "/diretor/prioridades", "/diretor/academico", "/diretor/oferta-territorios"];
  if (cyclePaths.some((p) => href === p || (p !== "/diretor" && href.startsWith(p)))) {
    const scope = search.get("scope");
    const cycleId = search.get("cycleId");
    if (scope) sp.set("scope", scope);
    if (cycleId) sp.set("cycleId", cycleId);
  }
  if (href.startsWith("/diretor/financeiro") || href.startsWith("/diretor/administrativo")) {
    const c = search.get("competence");
    if (c) sp.set("competence", c);
  }
  if (href.startsWith("/diretor/impacto-social")) {
    for (const k of ["from", "to", "cycleId"]) {
      const v = search.get(k);
      if (v) sp.set(k, v);
    }
  }
  if (href.startsWith("/diretor/projetos-convenios")) {
    const y = search.get("year");
    if (y) sp.set("year", y);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function DirectorSubnav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const groups = ["Direção", "Desempenho", "Gestão", "Documentos"] as const;

  return (
    <nav aria-label="Área do Diretor" className="mb-6 border-b border-[var(--card-border)] pb-3">
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const items = NAV.filter((i) => i.group === group);
          return (
            <div key={group}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{group}</p>
              <ul className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const active =
                    item.href === "/diretor" ? pathname === "/diretor" : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={`${item.href}${suffixFor(item.href, search)}`}
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
        Área somente leitura. Dashboard legado permanece até validação da substituição.
        {" · "}
        <Link href="/dashboard" className="underline hover:text-[var(--igh-primary)]">
          Dashboard legado (fallback)
        </Link>
      </p>
    </nav>
  );
}
