"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";

type Item = {
  href: string;
  label: string;
  masterOnly?: boolean;
  masterOrTeacher?: boolean;
  adminOrMaster?: boolean;
  studentOnly?: boolean;
  alwaysShow?: boolean;
  category?: string;
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard", alwaysShow: true, category: "Início" },
  { href: "/minhas-turmas", label: "Minhas turmas", studentOnly: true, category: "Aluno" },
  { href: "/meus-dados", label: "Meus dados", studentOnly: true, category: "Aluno" },
  { href: "/users", label: "Usuários (Admin)", masterOnly: true, category: "Administração" },
  { href: "/approvacoes", label: "Aprovações (Site)", masterOnly: true, category: "Administração" },
  { href: "/teachers", label: "Professores", adminOrMaster: true, category: "Administração" },
  { href: "/admin/site/formacoes", label: "Formações", adminOrMaster: true, category: "Administração" },
  { href: "/courses", label: "Cursos", masterOrTeacher: true, category: "Administração" },
  { href: "/class-groups", label: "Turmas", masterOnly: true, category: "Administração" },
  { href: "/enrollments", label: "Matrículas", adminOrMaster: true, category: "Administração" },
  { href: "/students", label: "Alunos", category: "Administração" },
  { href: "/admin/site/configuracoes", label: "Configurações", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/mensagens-contato", label: "Mensagens de contato", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/sobre", label: "Sobre", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/formacoes-pagina", label: "Formações (página)", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/inscreva-pagina", label: "Inscreva-se (página)", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/contato-pagina", label: "Contato (página)", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/menu", label: "Menu", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/banners", label: "Banners", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/projetos", label: "Projetos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/depoimentos", label: "Depoimentos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/parceiros", label: "Parceiros", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/noticias", label: "Notícias", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/faq", label: "FAQ", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/transparencia", label: "Transparência", adminOrMaster: true, category: "Site" },
  { href: "/time-slots", label: "Horários", masterOnly: true, category: "Configurações" },
  { href: "/holidays", label: "Feriados", masterOnly: true, category: "Configurações" },
];

type RoleOption = { value: "STUDENT" | "TEACHER" | "ADMIN" | "MASTER"; label: string };

export function Sidebar({
  user,
  logoUrl = null,
  mobileOpen = false,
  onMobileClose,
}: {
  user: {
    name: string;
    email: string;
    role: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";
    baseRole?: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";
    isAdmin?: boolean;
    hasStudentProfile?: boolean;
    hasTeacherProfile?: boolean;
  };
  logoUrl?: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const canStudent = user.hasStudentProfile === true;
  const canTeacher = user.hasTeacherProfile === true;
  const canAdmin = user.isAdmin === true && user.baseRole !== "MASTER";
  const canMaster = user.baseRole === "MASTER";
  let roleOptions: RoleOption[] = [
    ...(canMaster ? [{ value: "MASTER" as const, label: "Administrador Master" }] : []),
    ...(canStudent ? [{ value: "STUDENT" as const, label: "Aluno" }] : []),
    ...(canTeacher ? [{ value: "TEACHER" as const, label: "Professor" }] : []),
    ...(canAdmin ? [{ value: "ADMIN" as const, label: "Admin" }] : []),
  ];
  if (!roleOptions.some((o) => o.value === user.role)) {
    roleOptions = [...roleOptions, { value: user.role as RoleOption["value"], label: { MASTER: "Administrador Master", ADMIN: "Admin", TEACHER: "Professor", STUDENT: "Aluno" }[user.role] ?? user.role }];
  }
  const showRoleSwitcher = roleOptions.length > 1;

  async function onRoleChange(newRole: "STUDENT" | "TEACHER" | "ADMIN" | "MASTER") {
    if (newRole === user.role) return;
    setSwitchingRole(true);
    try {
      const res = await fetch("/api/auth/choose-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSwitchingRole(false);
    }
  }

  const filteredItems = ITEMS.filter((i) => {
    if (i.alwaysShow) return true;
    if (i.studentOnly) return user.role === "STUDENT";
    if (i.masterOnly) return user.role === "MASTER";
    if (i.masterOrTeacher) return user.role === "MASTER" || user.role === "TEACHER";
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
  const categoryOrder = ["Início", "Aluno", "Administração", "Site", "Configurações", "Menu"];

  const navContent = (
    <ul className="flex list-none flex-col gap-4 pl-0">
      {categoryOrder.filter((cat) => byCategory[cat]?.length).map((cat) => (
        <li key={cat}>
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {cat}
          </div>
          <ul className="flex list-none flex-col gap-0.5 pl-0">
            {byCategory[cat].map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm ${
                      active ? "bg-[var(--igh-primary)] text-white" : "text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
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
      <div className="shrink-0 border-b border-[var(--card-border)] px-4 py-4">
        <div className="flex justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
          ) : (
            <img src="/images/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
          )}
        </div>
        <div className="mt-3 text-xs text-[var(--text-secondary)]">{user.name}</div>
        <div className="truncate text-xs text-[var(--text-muted)]" title={user.email}>{user.email}</div>
        {showRoleSwitcher ? (
          <div className="mt-2">
            <label className="sr-only" htmlFor="sidebar-role">Perfil de acesso</label>
            <select
              id="sidebar-role"
              value={user.role}
              disabled={switchingRole}
              onChange={(e) => onRoleChange(e.target.value as "STUDENT" | "TEACHER" | "ADMIN" | "MASTER")}
              className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-[var(--input-text)] focus:border-[var(--igh-primary)] focus:outline-none"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">
            {{ MASTER: "Administrador Master", ADMIN: "Admin", TEACHER: "Professor", STUDENT: "Aluno" }[user.role] ?? user.role}
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">{navContent}</nav>
      <div className="shrink-0 space-y-2 border-t border-[var(--card-border)] p-3">
        <ThemeToggle className="w-full" showLabel />
        <Link
          href="/"
          className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:opacity-90 touch-manipulation"
        >
          Acessar site
        </Link>
        <Button variant="secondary" className="w-full" onClick={logout} disabled={loading}>
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: sidebar fixa à esquerda */}
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-[var(--card-border)] bg-[var(--card-bg)] md:flex">
        {sidebarContent}
      </aside>
      {/* Mobile: drawer que desliza da esquerda */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg transition-transform duration-200 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-3 py-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded p-2 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
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
