"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BRAND } from "@/lib/brand";
import { resolveLogoHeightPx } from "@/lib/site-types";

type PanelRole =
  | "MASTER"
  | "GENERAL_ADMIN"
  | "ADMIN"
  | "ADMIN_MANAGER"
  | "SITE_ADMIN"
  | "POLO_COORDINATOR"
  | "TEACHER"
  | "STUDENT";

type Item = {
  href: string;
  label: string;
  /** Perfis que enxergam o item no menu. */
  roles: readonly PanelRole[];
  category: string;
  /** Só aparece se a conta tiver ficha de colaborador vinculada. */
  requiresEmployee?: boolean;
};

const ALL_ROLES = [
  "MASTER",
  "GENERAL_ADMIN",
  "ADMIN",
  "ADMIN_MANAGER",
  "SITE_ADMIN",
  "POLO_COORDINATOR",
  "TEACHER",
  "STUDENT",
] as const;
/** Equipe pedagógica da sede (sem Admin Site). */
const STAFF = ["MASTER", "GENERAL_ADMIN", "ADMIN"] as const;
const STAFF_AND_TEACHER = ["MASTER", "GENERAL_ADMIN", "ADMIN", "TEACHER"] as const;
/** Administração pedagógica (sem Site/Comunicação). */
const MASTER_AND_ADMIN = ["MASTER", "GENERAL_ADMIN", "ADMIN"] as const;
/** Master e Administrador Geral (governança plena). */
const MASTER_OR_GENERAL = ["MASTER", "GENERAL_ADMIN"] as const;
/** Comunicação e Site: Master, Admin Geral e Administrador Site. */
const SITE_AND_COMMS = ["MASTER", "GENERAL_ADMIN", "SITE_ADMIN"] as const;
/** Gerência Administrativa: pessoas, patrimônio, doações e financeiro. */
const ADMIN_MANAGEMENT = ["MASTER", "GENERAL_ADMIN", "ADMIN_MANAGER"] as const;

/**
 * Ordem do array = ordem no menu dentro de cada categoria.
 * Categorias: Início → Área do aluno/professor → Pedagógico (oferta e acompanhamento)
 * → Administração (governança) → Comunicação → Site público → Configurações do sistema.
 */
const ITEMS: Item[] = [
  /* —— Início —— */
  {
    href: "/dashboard",
    label: "Página Inicial",
    roles: [...ALL_ROLES],
    category: "Início",
  },
  {
    href: "/onboarding",
    label: "Como usar o sistema",
    roles: [...ALL_ROLES],
    category: "Início",
  },
  {
    href: "/minhas-indicacoes",
    label: "Minhas indicações",
    roles: ["MASTER", "GENERAL_ADMIN", "ADMIN", "POLO_COORDINATOR", "TEACHER", "STUDENT"],
    category: "Início",
  },
  { href: "/coordenacao", label: "Coordenação", roles: STAFF_AND_TEACHER, category: "Início" },

  /* —— Colaborador (portal) —— */
  {
    href: "/colaborador",
    label: "Meu portal",
    roles: ALL_ROLES,
    category: "Colaborador",
    requiresEmployee: true,
  },
  {
    href: "/colaborador/notas",
    label: "Enviar nota",
    roles: ALL_ROLES,
    category: "Colaborador",
    requiresEmployee: true,
  },
  {
    href: "/colaborador/mensagens",
    label: "Falar com a gerência",
    roles: ALL_ROLES,
    category: "Colaborador",
    requiresEmployee: true,
  },

  /* —— Aluno —— */
  { href: "/minhas-turmas", label: "Minhas turmas", roles: ["STUDENT"], category: "Aluno" },
  { href: "/minhas-turmas/evolucao", label: "Evolução e ranking", roles: ["STUDENT"], category: "Aluno" },
  { href: "/minhas-turmas/calendario", label: "Calendário de aulas", roles: ["STUDENT"], category: "Aluno" },
  { href: "/comunidade", label: `${BRAND.communityName} (PII)`, roles: ["STUDENT"], category: "Aluno" },
  { href: "/minhas-turmas/forum", label: "Fórum dos cursos", roles: ["STUDENT"], category: "Aluno" },

  /* —— Professor —— */
  { href: "/professor/turmas", label: "Turmas que leciono", roles: ["TEACHER"], category: "Professor" },
  { href: "/professor/acompanhamento", label: "Acompanhamento", roles: ["TEACHER"], category: "Professor" },
  { href: "/professor/calendario", label: "Calendário de aulas", roles: ["TEACHER"], category: "Professor" },
  { href: "/comunidade", label: `${BRAND.communityName} (PII)`, roles: ["TEACHER"], category: "Professor" },
  { href: "/professor/forum", label: "Fórum dos cursos", roles: ["TEACHER"], category: "Professor" },
  { href: "/professor/eventos", label: "Eventos (presença)", roles: ["TEACHER"], category: "Professor" },
  { href: "/professor/frequencia", label: "Frequência", roles: ["TEACHER"], category: "Professor" },
  { href: "/gamificacao", label: "Gamificação", roles: ["TEACHER"], category: "Professor" },
  { href: "/ranking-alunos", label: "Ranking dos alunos", roles: ["TEACHER"], category: "Professor" },
  { href: "/professor/avaliacoes-experiencia", label: "Avaliações de experiência", roles: ["TEACHER"], category: "Professor" },

  /* —— Pedagógico —— */
  { href: "/teachers", label: "Professores", roles: STAFF, category: "Pedagógico" },
  { href: "/students", label: "Alunos", roles: STAFF_AND_TEACHER, category: "Pedagógico" },
  { href: "/courses", label: "Cursos", roles: STAFF_AND_TEACHER, category: "Pedagógico" },
  { href: "/admin/cursos/planos-de-aula", label: "Planos de aula (PDF)", roles: STAFF, category: "Pedagógico" },
  { href: "/class-groups", label: "Turmas", roles: STAFF, category: "Pedagógico" },
  { href: "/admin/polos", label: "Polos", roles: STAFF, category: "Pedagógico" },
  {
    href: "/enrollments",
    label: "Matrículas",
    roles: ["MASTER", "GENERAL_ADMIN", "ADMIN", "POLO_COORDINATOR"],
    category: "Pedagógico",
  },
  { href: "/horarios", label: "Quadro de horários", roles: STAFF, category: "Pedagógico" },
  { href: "/admin/frequencia", label: "Frequência — todas as turmas", roles: STAFF, category: "Pedagógico" },

  /* —— Administração —— */
  { href: "/admin/plataforma", label: "Visão da plataforma", roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/admin/calendario", label: "Calendário institucional", roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/admin/onboarding", label: "Guia do sistema (edição)", roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/users", label: "Usuários", roles: MASTER_OR_GENERAL, category: "Administração" },
  { href: "/master/acessos", label: "Acessos ao sistema", roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/approvacoes", label: "Aprovações do site", roles: MASTER_OR_GENERAL, category: "Administração" },
  { href: "/admin/site/formacoes", label: "Formações (catálogo)", roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/admin/comunidade", label: `${BRAND.communityName} — moderação`, roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/comunidade", label: `${BRAND.communityName} (PII)`, roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/admin/forum", label: "Fóruns — todos os cursos", roles: MASTER_AND_ADMIN, category: "Administração" },
  {
    href: "/admin/avaliacoes-experiencia",
    label: "Avaliações de experiência",
    roles: MASTER_AND_ADMIN,
    category: "Administração",
  },
  { href: "/holidays", label: "Inscrições em eventos", roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/gamificacao", label: "Gamificação", roles: MASTER_AND_ADMIN, category: "Administração" },
  { href: "/ranking-alunos", label: "Ranking dos alunos", roles: MASTER_AND_ADMIN, category: "Administração" },

  /* —— Gerência —— */
  { href: "/admin/gerencia", label: "Central administrativa", roles: ADMIN_MANAGEMENT, category: "Gerência" },
  {
    href: "/admin/gerencia/portal",
    label: "Portal (fila)",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/colaboradores",
    label: "Colaboradores",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/contratos",
    label: "Contratos",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/modelos",
    label: "Modelos oficiais",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/financeiro",
    label: "Financeiro",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/folha",
    label: "Folha de pagamento",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/metas",
    label: "Metas anuais",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/convenios",
    label: "Convênios",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/almoxarifado",
    label: "Almoxarifado",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/equipamentos",
    label: "Equipamentos",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/donatarias",
    label: "Donatárias",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/doacoes",
    label: "Doações",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/visitas",
    label: "Checklist de visitas",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/relatorio-beneficiados",
    label: "Relatório Excel",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },
  {
    href: "/admin/gerencia/configuracoes-doadora",
    label: "Config. da doadora",
    roles: ADMIN_MANAGEMENT,
    category: "Gerência",
  },

  /* —— Comunicação —— */
  { href: "/admin/sms", label: "Campanhas SMS", roles: SITE_AND_COMMS, category: "Comunicação" },
  { href: "/admin/email", label: "Campanhas de e-mail", roles: SITE_AND_COMMS, category: "Comunicação" },
  { href: "/admin/campanhas", label: "Campanhas (site e alunos)", roles: SITE_AND_COMMS, category: "Comunicação" },

  /* —— Site —— */
  { href: "/admin/site/configuracoes", label: "Configurações gerais", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/menu", label: "Menu do site", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/banners", label: "Banners", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/tablet/banners", label: "Banners (aluno)", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/mensagens-contato", label: "Mensagens de contato", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/contato-pagina", label: "Página de contato", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/sobre", label: "Página Sobre", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/espaco-maker", label: "Página Espaço Maker", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/formacoes-pagina", label: "Página de formações", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/inscreva-pagina", label: "Página Inscreva-se", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/projetos", label: "Projetos", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/noticias", label: "Notícias", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/depoimentos", label: "Depoimentos", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/parceiros", label: "Parceiros", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/unidades", label: "Unidades", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/faq", label: "FAQ", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/legal", label: "Termos e privacidade", roles: SITE_AND_COMMS, category: "Site" },
  { href: "/admin/site/transparencia", label: "Transparência", roles: SITE_AND_COMMS, category: "Site" },

  /* —— Configurações —— */
  { href: "/time-slots", label: "Horários (cadastro)", roles: MASTER_OR_GENERAL, category: "Configurações" },
  { href: "/backup", label: "Backup do banco", roles: MASTER_OR_GENERAL, category: "Configurações" },
];

export function Sidebar({
  user,
  logoUrl = null,
  logoHeightPx,
  drawerOpen = false,
  onDrawerClose,
  sidebarExpanded = true,
  onSidebarCollapse,
  onSidebarExpand,
}: {
  user: {
    name: string;
    email: string;
    role: "MASTER" | "GENERAL_ADMIN" | "ADMIN" | "ADMIN_MANAGER" | "SITE_ADMIN" | "POLO_COORDINATOR" | "TEACHER" | "STUDENT";
    baseRole?: "MASTER" | "GENERAL_ADMIN" | "ADMIN" | "ADMIN_MANAGER" | "SITE_ADMIN" | "POLO_COORDINATOR" | "TEACHER" | "STUDENT";
    isAdmin?: boolean;
    isSiteAdmin?: boolean;
    hasStudentProfile?: boolean;
    hasTeacherProfile?: boolean;
    hasEmployeeProfile?: boolean;
    availableRoles?: {
      canMaster: boolean;
      canGeneralAdmin?: boolean;
      canStudent: boolean;
      canTeacher: boolean;
      canAdmin: boolean;
      canSiteAdmin?: boolean;
      canPoloCoordinator?: boolean;
      canAdminManager?: boolean;
    };
  };
  logoUrl?: string | null;
  logoHeightPx?: number | null;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
  /** md+: barra lateral fixa visível (persistida no shell). */
  sidebarExpanded?: boolean;
  onSidebarCollapse?: () => void;
  /** md+: restaura barra fixa e fecha o drawer. */
  onSidebarExpand?: () => void;
}) {
  const pathname = usePathname();
  const resolvedLogoHeight = resolveLogoHeightPx(logoHeightPx);

  const filteredItems = ITEMS.filter((i) => {
    if (!i.roles.includes(user.role)) return false;
    if (i.requiresEmployee && !user.hasEmployeeProfile) return false;
    return true;
  });

  const byCategory = filteredItems.reduce<Record<string, Item[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categoryOrder = [
    "Início",
    "Colaborador",
    "Aluno",
    "Professor",
    "Pedagógico",
    "Administração",
    "Gerência",
    "Comunicação",
    "Site",
    "Configurações",
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
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: resolvedLogoHeight }}
          className="w-auto max-w-full object-contain"
        />
      ) : (
        <img
          src="/images/logo.png"
          alt="Logo"
          style={{ height: resolvedLogoHeight }}
          className="w-auto max-w-full object-contain"
        />
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
