"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { label: "Início", href: "/" },
  { label: "Sobre", href: "/sobre" },
  { label: "Formações", href: "/formacoes" },
  { label: "Projetos", href: "/projetos" },
  { label: "Notícias", href: "/noticias" },
  { label: "Transparência", href: "/transparencia" },
  { label: "Contato", href: "/contato" },
];

const subProjetos = [
  { label: "Computadores para Inclusão", href: "/projetos/computadores-para-inclusao" },
  { label: "CRC", href: "/projetos/crc" },
  { label: "Doações Recebidas", href: "/projetos/doacoes-recebidas" },
  { label: "Entregas", href: "/projetos/entregas" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [projetosOpen, setProjetosOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--igh-border)] bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8" aria-label="Menu principal">
        <Link href="/" className="text-xl font-bold text-[var(--igh-primary)] rounded focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2">
          IGH
        </Link>
        <div className="hidden md:flex md:items-center md:gap-1">
          {links.map((l) => (
            l.href === "/projetos" ? (
              <div key={l.href} className="relative">
                <button
                  type="button"
                  onClick={() => setProjetosOpen(!projetosOpen)}
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--igh-secondary)] hover:text-[var(--igh-primary)]"
                  aria-expanded={projetosOpen}
                >
                  Projetos
                  <span className={projetosOpen ? "rotate-180" : ""}>▼</span>
                </button>
                {projetosOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-[var(--igh-border)] bg-white py-2 shadow-lg">
                    {subProjetos.map((s) => (
                      <Link key={s.href} href={s.href} className="block px-4 py-2 text-sm text-[var(--igh-secondary)] hover:bg-[var(--igh-surface)]" onClick={() => setProjetosOpen(false)}>
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-2 text-sm font-medium ${pathname === l.href ? "text-[var(--igh-primary)]" : "text-[var(--igh-secondary)] hover:text-[var(--igh-primary)]"}`}
              >
                {l.label}
              </Link>
            )
          ))}
          <Link href="/login" className="ml-2 rounded-lg bg-[var(--igh-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--igh-accent-hover)] min-h-[44px] inline-flex items-center justify-center">
            Área do Aluno
          </Link>
        </div>
        <button type="button" className="md:hidden rounded p-2 text-[var(--igh-secondary)]" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"}>
          {open ? "✕" : "☰"}
        </button>
      </nav>
      {open && (
        <div className="border-t border-[var(--igh-border)] bg-white px-4 py-4 md:hidden">
          {links.map((l) => (
            <div key={l.href}>
              <Link href={l.href} className="block py-2 text-[var(--igh-secondary)]" onClick={() => setOpen(false)}>{l.label}</Link>
              {l.href === "/projetos" && subProjetos.map((s) => (
                <Link key={s.href} href={s.href} className="ml-4 block py-1 text-sm text-[var(--igh-muted)]" onClick={() => setOpen(false)}>{s.label}</Link>
              ))}
            </div>
          ))}
          <Link href="/login" className="mt-2 inline-block rounded-lg bg-[var(--igh-accent)] px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(false)}>Área do Aluno</Link>
        </div>
      )}
    </header>
  );
}
