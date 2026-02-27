"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

type Item = {
  href: string;
  label: string;
  masterOnly?: boolean;
  adminOrMaster?: boolean;
  studentOnly?: boolean;
  alwaysShow?: boolean;
  category?: string;
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard", alwaysShow: true, category: "Início" },
  { href: "/minhas-turmas", label: "Minhas turmas", studentOnly: true, category: "Aluno" },
  { href: "/users", label: "Usuários (Admin)", masterOnly: true, category: "Administração" },
  { href: "/teachers", label: "Professores", masterOnly: true, category: "Administração" },
  { href: "/courses", label: "Cursos", masterOnly: true, category: "Administração" },
  { href: "/class-groups", label: "Turmas", masterOnly: true, category: "Administração" },
  { href: "/enrollments", label: "Matrículas", masterOnly: true, category: "Administração" },
  { href: "/admin/site/configuracoes", label: "Configurações", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/menu", label: "Menu", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/banners", label: "Banners", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/formacoes", label: "Formações", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/projetos", label: "Projetos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/depoimentos", label: "Depoimentos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/parceiros", label: "Parceiros", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/noticias", label: "Notícias", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/faq", label: "FAQ", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/transparencia", label: "Transparência", adminOrMaster: true, category: "Site" },
  { href: "/time-slots", label: "Horários", masterOnly: true, category: "Configurações" },
  { href: "/holidays", label: "Feriados", masterOnly: true, category: "Configurações" },
  { href: "/students", label: "Alunos", category: "Cadastro" },
];

export function Sidebar({
  user,
  mobileOpen = false,
  onMobileClose,
}: {
  user: { name: string; email: string; role: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT" };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const filteredItems = ITEMS.filter((i) => {
    if (i.alwaysShow) return true;
    if (i.studentOnly) return user.role === "STUDENT";
    if (i.masterOnly) return user.role === "MASTER";
    if (i.adminOrMaster) return user.role === "ADMIN" || user.role === "MASTER";
    return user.role !== "STUDENT";
  });

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const byCategory = filteredItems.reduce<Record<string, Item[]>>((acc, item) => {
    const cat = item.category ?? "Menu";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categoryOrder = ["Início", "Aluno", "Administração", "Site", "Configurações", "Cadastro", "Menu"];

  const navContent = (
    <ul className="flex flex-col gap-4">
      {categoryOrder.filter((cat) => byCategory[cat]?.length).map((cat) => (
        <li key={cat}>
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {cat}
          </div>
          <ul className="flex flex-col gap-0.5">
            {byCategory[cat].map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm ${
                      active ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
                    }`}
                    onClick={onMobileClose}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );

  const sidebarContent = (
    <>
      <div className="shrink-0 border-b border-zinc-200 px-4 py-4">
        <div className="flex justify-center">
          <img src="/images/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
        </div>
        <div className="mt-3 text-sm font-semibold">Cadastro de Cursos</div>
        <div className="mt-2 text-xs text-zinc-600">{user.name}</div>
        <div className="text-xs text-zinc-500 truncate" title={user.email}>{user.email}</div>
        <div className="mt-1 text-[11px] font-medium text-zinc-700">{user.role}</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">{navContent}</nav>
      <div className="border-t border-zinc-200 p-3 shrink-0">
        <Button variant="secondary" className="w-full" onClick={logout} disabled={loading}>
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: sidebar fixa à esquerda */}
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        {sidebarContent}
      </aside>
      {/* Mobile: drawer que desliza da esquerda */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-zinc-200 bg-white shadow-lg transition-transform duration-200 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2">
          <span className="text-sm font-semibold">Menu</span>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded p-2 text-zinc-600 hover:bg-zinc-100"
            aria-label="Fechar menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
