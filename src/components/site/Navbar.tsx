"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { MenuItemPublic, SiteSettingsPublic } from "@/lib/site-types";

const FALLBACK_LINKS: MenuItemPublic[] = [
  { id: "1", label: "Início", href: "/", order: 0, isExternal: false, children: [] },
  { id: "2", label: "Sobre", href: "/sobre", order: 1, isExternal: false, children: [] },
  { id: "3", label: "Formações", href: "/formacoes", order: 2, isExternal: false, children: [] },
  { id: "4", label: "Projetos", href: "/projetos", order: 3, isExternal: false, children: [
    { id: "4a", label: "Computadores para Inclusão", href: "/projetos/computadores-para-inclusao", order: 0, isExternal: false, children: [] },
    { id: "4b", label: "CRC", href: "/projetos/crc", order: 1, isExternal: false, children: [] },
    { id: "4c", label: "Doações Recebidas", href: "/projetos/doacoes-recebidas", order: 2, isExternal: false, children: [] },
    { id: "4d", label: "Entregas", href: "/projetos/entregas", order: 3, isExternal: false, children: [] },
  ]},
  { id: "5", label: "Notícias", href: "/noticias", order: 4, isExternal: false, children: [] },
  { id: "6", label: "Transparência", href: "/transparencia", order: 5, isExternal: false, children: [] },
  { id: "7", label: "Contato", href: "/contato", order: 6, isExternal: false, children: [] },
];

type SessionUserNav = { name: string; email: string; role: string };

type NavbarProps = {
  menuItems?: MenuItemPublic[] | null;
  settings?: SiteSettingsPublic | null;
  sessionUser?: SessionUserNav | null;
};

export function Navbar({ menuItems: propItems, settings, sessionUser }: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [projetosOpen, setProjetosOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const links = (propItems && propItems.length > 0) ? propItems : FALLBACK_LINKS;
  const logoUrl = settings?.logoUrl;

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [open]);

  return (
    <>
      {scrolled && headerHeight > 0 && <div aria-hidden className="shrink-0" style={{ height: headerHeight }} />}
      <header
        ref={headerRef}
        className={`z-40 border-b border-[var(--igh-border)] bg-[var(--background)] backdrop-blur transition-shadow ${scrolled ? "fixed left-0 right-0 top-0 shadow-md" : "sticky top-0"}`}
      >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8" aria-label="Menu principal">
        <Link href="/" className="flex shrink-0 items-center rounded focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2">
          {logoUrl ? (
            <span className={`inline-block rounded-lg bg-white transition-[padding] ${scrolled ? "p-1" : "p-2"}`}>
              <img src={logoUrl} alt={settings?.siteName ?? "Logo"} className={`w-auto object-contain transition-[height] ${scrolled ? "h-7 sm:h-8" : "h-10 sm:h-12"}`} />
            </span>
          ) : (
            <span className="text-xl font-bold text-[var(--igh-primary)]">IGH</span>
          )}
        </Link>
        <div className="hidden md:flex md:items-center md:gap-1">
          {links.map((l) => (
            l.children && l.children.length > 0 ? (
              <div key={l.id} className="relative">
                <button
                  type="button"
                  onClick={() => setProjetosOpen(!projetosOpen)}
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--igh-secondary)] hover:text-[var(--igh-primary)]"
                  aria-expanded={projetosOpen}
                >
                  {l.label}
                  <span className={projetosOpen ? "rotate-180" : ""}>▼</span>
                </button>
                {projetosOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] py-2 shadow-lg">
                    {l.children.map((s) => (
                      <Link key={s.id} href={s.href} className="block px-4 py-2 text-sm text-[var(--igh-secondary)] hover:bg-[var(--igh-surface)]" onClick={() => setProjetosOpen(false)}>
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={l.id}
                href={l.href}
                className={`rounded-md px-3 py-2 text-sm font-medium ${pathname === l.href ? "text-[var(--igh-primary)]" : "text-[var(--igh-secondary)] hover:text-[var(--igh-primary)]"}`}
              >
                {l.label}
              </Link>
            )
          ))}
          <ThemeToggle className="ml-1" />
          {sessionUser ? (
            <div className="ml-2 flex items-center gap-2 rounded-lg border border-[var(--igh-border)] bg-[var(--igh-surface)] px-3 py-1.5">
              <span className="max-w-[120px] truncate text-xs text-[var(--text-muted)] sm:max-w-[160px]" title={sessionUser.email}>
                {sessionUser.name}
              </span>
              <Link
                href={sessionUser.role === "STUDENT" ? "/minhas-turmas" : "/dashboard"}
                className={sessionUser.role === "STUDENT"
                  ? "rounded-md bg-[var(--igh-primary)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--igh-primary-hover)]"
                  : "flex h-8 w-8 items-center justify-center rounded-md bg-[var(--igh-primary)] text-white hover:bg-[var(--igh-primary-hover)]"}
                aria-label={sessionUser.role === "STUDENT" ? "Área do aluno" : "Painel"}
                title={sessionUser.role === "STUDENT" ? "Área do aluno" : "Painel"}
              >
                {sessionUser.role === "STUDENT" ? (
                  "Área do aluno"
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </Link>
            </div>
          ) : (
            <Link href="/login" className="ml-2 rounded-lg bg-[var(--igh-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--igh-accent-hover)] min-h-[44px] inline-flex items-center justify-center">
              Área do Aluno
            </Link>
          )}
        </div>
        <button type="button" className="md:hidden rounded p-2 text-[var(--igh-secondary)]" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"}>
          {open ? "✕" : "☰"}
        </button>
      </nav>
      {open && (
        <div className="border-t border-[var(--igh-border)] bg-[var(--card-bg)] px-4 py-4 md:hidden">
          {links.map((l) => (
            <div key={l.id}>
              <Link href={l.href} className="block py-2 text-[var(--igh-secondary)]" onClick={() => setOpen(false)}>{l.label}</Link>
              {l.children && l.children.length > 0 && l.children.map((s) => (
                <Link key={s.id} href={s.href} className="ml-4 block py-1 text-sm text-[var(--igh-muted)]" onClick={() => setOpen(false)}>{s.label}</Link>
              ))}
            </div>
          ))}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ThemeToggle showLabel />
            {sessionUser ? (
              <>
                <span className="truncate text-xs text-[var(--text-muted)]" title={sessionUser.email}>{sessionUser.name}</span>
                <Link href={sessionUser.role === "STUDENT" ? "/minhas-turmas" : "/dashboard"} className="inline-flex items-center gap-2 rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(false)}>
                  {sessionUser.role === "STUDENT" ? "Área do aluno" : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Painel
                    </>
                  )}
                </Link>
              </>
            ) : (
              <Link href="/login" className="rounded-lg bg-[var(--igh-accent)] px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(false)}>Área do Aluno</Link>
            )}
          </div>
        </div>
      )}
    </header>
    </>
  );
}
