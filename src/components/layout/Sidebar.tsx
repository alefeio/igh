"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  masterOnly?: boolean;
  masterOrTeacher?: boolean;
  adminOrMaster?: boolean;
  /** Destaque: rotas que antes eram só Admin/Master (campanhas). */
  adminMasterOnly?: boolean;
  studentOnly?: boolean;
  teacherOnly?: boolean;
  /** Professor, admin, master ou coordenador — reportes à coordenação. */
  coordinatorAccess?: boolean;
  alwaysShow?: boolean;
  /** Apenas Master ou Admin (ex.: edição do onboarding). */
  masterOrAdminOnly?: boolean;
  category?: string;
};

/**
 * Ordem do array = ordem no menu dentro de cada categoria.
 * Categorias: Início → Área do aluno/professor → Administração (cadastros e operação) → Comunicação → Site público → Configurações do sistema.
 */
const ITEMS: Item[] = [
  /* —— Início (todos) —— */
  { href: "/dashboard", label: "Dashboard", alwaysShow: true, category: "Início" },
  { href: "/onboarding", label: "Como usar o sistema", alwaysShow: true, category: "Início" },
  { href: "/meus-dados", label: "Meus dados", alwaysShow: true, category: "Início" },
  {
    href: "/coordenacao",
    label: "Coordenação",
    coordinatorAccess: true,
    category: "Início",
  },

  /* —— Aluno —— */
  { href: "/minhas-turmas", label: "Minhas turmas", studentOnly: true, category: "Aluno" },
  { href: "/minhas-turmas/forum", label: "Fórum dos cursos", studentOnly: true, category: "Aluno" },

  /* —— Professor —— */
  { href: "/professor/turmas", label: "Turmas que leciono", teacherOnly: true, category: "Professor" },
  { href: "/professor/forum", label: "Fórum dos cursos", teacherOnly: true, category: "Professor" },
  { href: "/professor/frequencia", label: "Frequência", teacherOnly: true, category: "Professor" },
  { href: "/gamificacao", label: "Gamificação", teacherOnly: true, category: "Professor" },
  { href: "/professor/avaliacoes-experiencia", label: "Avaliações de experiência", teacherOnly: true, category: "Professor" },

  /* —— Administração (equipa: governança → pessoas → oferta → acompanhamento) —— */
  {
    href: "/admin/onboarding",
    label: "Guia do sistema (edição)",
    masterOrAdminOnly: true,
    category: "Administração",
  },
  { href: "/users", label: "Usuários", masterOnly: true, category: "Administração" },
  { href: "/approvacoes", label: "Aprovações do site", masterOnly: true, category: "Administração" },
  { href: "/teachers", label: "Professores", adminOrMaster: true, category: "Administração" },
  { href: "/students", label: "Alunos", category: "Administração" },
  { href: "/courses", label: "Cursos", masterOrTeacher: true, category: "Administração" },
  { href: "/class-groups", label: "Turmas", adminOrMaster: true, category: "Administração" },
  { href: "/enrollments", label: "Matrículas", adminOrMaster: true, category: "Administração" },
  { href: "/horarios", label: "Quadro de horários", adminOrMaster: true, category: "Administração" },
  {
    href: "/admin/site/formacoes",
    label: "Formações (catálogo)",
    adminOrMaster: true,
    adminMasterOnly: true,
    category: "Administração",
  },
  { href: "/admin/forum", label: "Fóruns — todos os cursos", adminOrMaster: true, category: "Administração" },
  { href: "/admin/frequencia", label: "Frequência — todas as turmas", adminOrMaster: true, category: "Administração" },
  { href: "/admin/avaliacoes-experiencia", label: "Avaliações de experiência", adminOrMaster: true, category: "Administração" },
  { href: "/gamificacao", label: "Gamificação", adminOrMaster: true, category: "Administração" },

  /* —— Comunicação (campanhas) —— */
  { href: "/admin/sms", label: "Campanhas SMS", adminOrMaster: true, adminMasterOnly: true, category: "Comunicação" },
  {
    href: "/admin/email",
    label: "Campanhas de e-mail",
    adminOrMaster: true,
    adminMasterOnly: true,
    category: "Comunicação",
  },

  /* —— Site (CMS: geral → navegação → conteúdos → institucional) —— */
  { href: "/admin/site/configuracoes", label: "Configurações gerais", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/menu", label: "Menu do site", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/banners", label: "Banners", adminOrMaster: true, category: "Site" },
  { href: "/admin/tablet/banners", label: "Banners (tablet)", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/mensagens-contato", label: "Mensagens de contato", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/contato-pagina", label: "Página de contato", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/sobre", label: "Página Sobre", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/formacoes-pagina", label: "Página de formações", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/inscreva-pagina", label: "Página Inscreva-se", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/projetos", label: "Projetos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/noticias", label: "Notícias", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/depoimentos", label: "Depoimentos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/parceiros", label: "Parceiros", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/faq", label: "FAQ", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/legal", label: "Termos e privacidade", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/transparencia", label: "Transparência", adminOrMaster: true, category: "Site" },

  /* —— Configurações (sistema / infra) —— */
  { href: "/time-slots", label: "Horários (cadastro)", masterOnly: true, category: "Configurações" },
  { href: "/holidays", label: "Eventos e feriados", masterOnly: true, category: "Configurações" },
  { href: "/backup", label: "Backup do banco", masterOnly: true, category: "Configurações" },
];

export function Sidebar({
  user,
  logoUrl = null,
  drawerOpen = false,
  onDrawerClose,
  sidebarExpanded = true,
  onSidebarCollapse,
  onSidebarExpand,
}: {
  user: {
    name: string;
    email: string;
    role: "MASTER" | "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";
    baseRole?: "MASTER" | "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";
    isAdmin?: boolean;
    hasStudentProfile?: boolean;
    hasTeacherProfile?: boolean;
    availableRoles?: {
      canMaster: boolean;
      canStudent: boolean;
      canTeacher: boolean;
      canAdmin: boolean;
      canCoordinator?: boolean;
    };
  };
  logoUrl?: string | null;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
  /** md+: barra lateral fixa visível (persistida no shell). */
  sidebarExpanded?: boolean;
  onSidebarCollapse?: () => void;
  /** md+: restaura barra fixa e fecha o drawer. */
  onSidebarExpand?: () => void;
}) {
  const pathname = usePathname();

  const filteredItems = ITEMS.filter((i) => {
    if (i.alwaysShow) return true;
    if (i.masterOrAdminOnly) return user.role === "MASTER" || user.role === "ADMIN";
    if (i.coordinatorAccess) {
      return (
        user.role === "TEACHER" ||
        user.role === "ADMIN" ||
        user.role === "MASTER" ||
        user.role === "COORDINATOR"
      );
    }
    if (i.studentOnly) return user.role === "STUDENT";
    if (i.teacherOnly) return user.role === "TEACHER";
    if (i.masterOnly) return user.role === "MASTER" || user.role === "COORDINATOR";
    if (i.masterOrTeacher)
      return (
        user.role === "MASTER" ||
        user.role === "TEACHER" ||
        user.role === "ADMIN" ||
        user.role === "COORDINATOR"
      );
    if (i.adminOrMaster) {
      return user.role === "ADMIN" || user.role === "MASTER" || user.role === "COORDINATOR";
    }
    return user.role !== "STUDENT";
  });

  const byCategory = filteredItems.reduce<Record<string, Item[]>>((acc, item) => {
    const cat = item.category ?? "Menu";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categoryOrder = [
    "Início",
    "Aluno",
    "Professor",
    "Administração",
    "Comunicação",
    "Site",
    "Configurações",
    "Menu",
  ];

  const tourIdForHref = (href: string) =>
    href === "/minhas-turmas" ? "sidebar-minhas-turmas" : undefined;

  const navContent = (
    <ul className="flex list-none flex-col gap-0 pl-0">
      {categoryOrder.filter((cat) => byCategory[cat]?.length).map((cat, sectionIndex) => (
        <li key={cat} className="list-none">
          <div className={`mb-2 ${sectionIndex > 0 ? "mt-5 border-t border-[var(--card-border)] pt-5" : ""}`}>
            <h3 className="mb-2 px-1">
              <span className="flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 py-1.5 shadow-sm">
                <span className="h-4 w-1 shrink-0 rounded-full bg-[var(--igh-primary)]" aria-hidden />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  {cat}
                </span>
              </span>
            </h3>
            <ul className="flex list-none flex-col gap-0.5 pl-0">
              {byCategory[cat].map((item) => {
                const active = pathname === item.href;
                const tourId = tourIdForHref(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        active ? "bg-[var(--igh-primary)] text-white" : "text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                      }`}
                      onClick={onDrawerClose}
                      {...(tourId ? { "data-tour": tourId } : {})}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );

  const logoBlock = (
    <div className="flex min-w-0 flex-1 items-center justify-center">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-12 w-auto max-w-full object-contain" />
      ) : (
        <img src="/images/logo.png" alt="Logo" className="h-12 w-auto max-w-full object-contain" />
      )}
    </div>
  );

  const sidebarContent = (
    <>
      <div className="shrink-0 border-b border-[var(--card-border)] px-3 py-3 md:px-4 md:py-4">
        <div className="flex items-center gap-2">
          {logoBlock}
          {onSidebarCollapse ? (
            <button
              type="button"
              onClick={onSidebarCollapse}
              className="hidden shrink-0 rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] md:inline-flex"
              aria-label="Recolher menu"
              title="Recolher menu"
            >
              <PanelLeftClose className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">{navContent}</nav>
    </>
  );

  return (
    <>
      {/* md+: barra lateral fixa (recolhível) */}
      {sidebarExpanded ? (
        <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-[var(--card-border)] bg-[var(--card-bg)] md:flex">
          {sidebarContent}
        </aside>
      ) : null}

      {/* Drawer: mobile sempre; desktop quando menu recolhido */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg transition-transform duration-200 ease-out ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
        id="panel-nav-drawer"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--card-border)] px-3 py-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
          <div className="flex items-center gap-0.5">
            {onSidebarExpand ? (
              <button
                type="button"
                onClick={onSidebarExpand}
                className="hidden rounded p-2 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] md:inline-flex"
                aria-label="Fixar menu na lateral"
                title="Fixar menu na lateral"
              >
                <PanelLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDrawerClose}
              className="rounded p-2 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
              aria-label="Fechar menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-[var(--card-border)] px-3 py-3">
              <div className="flex justify-center">{logoBlock}</div>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">{navContent}</nav>
          </div>
        </div>
      </aside>
    </>
  );
}
