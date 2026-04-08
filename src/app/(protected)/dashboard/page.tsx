import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageCircle,
  PieChart,
  PlayCircle,
  School,
  Star,
  Trophy,
  UserCircle,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";

import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import {
  DashboardHero,
  QuickActionGrid,
  SectionCard,
  StatTile,
  TableShell,
} from "@/components/dashboard/DashboardUI";
import { StudentPlatformExperienceModal } from "@/components/student/StudentPlatformExperienceModal";
import { requireSessionUser } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardData,
  type DashboardDataAdmin,
  type ClassGroupSummary,
  type StudentEnrollmentSummary,
} from "@/lib/dashboard-data";
import { formatDaysShortPtBr } from "@/lib/turma-display";

const STATUS_LABELS: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
  INTERNO: "Interno",
  EXTERNO: "Externo",
};

/** Passos do tutorial exibido ao aluno na primeira vez no /dashboard */
const STUDENT_TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: "[data-tour=\"dashboard-welcome\"]",
    title: "Bem-vindo à Área do aluno",
    content: "Este é seu painel. Aqui você vê seu progresso, cursos matriculados e atalhos. Vamos mostrar os principais recursos.",
  },
  {
    target: "[data-tour=\"dashboard-progresso-geral\"]",
    title: "Seu progresso geral",
    content:
      "Aqui aparece quantas aulas você já concluiu no total e a barra de progresso. Conclua as aulas para avançar nos cursos. Use os atalhos abaixo para ver detalhes por curso, evolução, ranking e calendário — essas páginas carregam só quando você abre.",
  },
  {
    target: "[data-tour=\"dashboard-detalhes-engajamento\"]",
    title: "Detalhes de engajamento",
    content:
      "Evolução e ranking, desempenho em exercícios, fórum e calendário de aulas ficam em páginas próprias (Minhas turmas), para o painel inicial não ficar pesado.",
  },
  {
    target: "[data-tour=\"sidebar-minhas-turmas\"]",
    title: "Minhas turmas",
    content: "Pelo menu lateral você acessa seus cursos e o conteúdo das aulas. É por aqui que você estuda e acompanha o progresso.",
  },
  {
    target: "[data-tour=\"dashboard-acesso-minhas-turmas\"]",
    title: "Acesso rápido: Minhas turmas",
    content: "No painel você também pode ir direto para suas turmas e continuar de onde parou.",
  },
  {
    target: "[data-tour=\"dashboard-acesso-favoritos\"]",
    title: "Favoritos",
    content: "As aulas que você marcar como favoritas ficam salvas aqui para acesso rápido.",
  },
  {
    target: "[data-tour=\"dashboard-acesso-meus-dados\"]",
    title: "Meus dados",
    content: "Atualize seu cadastro e anexos quando precisar. Mantenha seus dados em dia.",
  },
  {
    target: "[data-tour=\"sidebar-meus-dados\"]",
    title: "Meus dados no menu",
    content: "O menu lateral também tem o atalho para Meus dados. Use-o a qualquer momento.",
  },
  {
    target: null,
    title: "Tudo pronto!",
    content: "Agora você já conhece a Área do aluno. Use o menu ao lado para navegar. Bom estudo!",
  },
];

/** Passos do tutorial exibido ao Admin/Master na primeira vez no /dashboard */
const ADMIN_TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: "[data-tour=\"admin-dashboard-welcome\"]",
    title: "Dashboard Admin",
    content:
      "Visão geral do sistema com totais de alunos, professores, cursos, turmas e matrículas. O painel inicial é leve; engajamento, rankings, fórum e calendário carregam nas páginas dedicadas.",
  },
  {
    target: "[data-tour=\"admin-dashboard-resumo\"]",
    title: "Resumo geral",
    content: "Cards com totais de Alunos, Professores, Cursos, Turmas e Matrículas. Clique em cada um para ir à página correspondente.",
  },
  {
    target: "[data-tour=\"admin-dashboard-detalhes\"]",
    title: "Detalhes da plataforma",
    content:
      "Abra Visão da plataforma para engajamento, rankings de professores e alunos, avaliações e fórum. Use Calendário institucional para sessões e feriados.",
  },
  {
    target: "[data-tour=\"admin-dashboard-atalhos\"]",
    title: "Atalhos",
    content: "Links rápidos para Matrículas, Alunos, Professores, Cursos e Turmas. O menu lateral também oferece acesso a todas as áreas.",
  },
  {
    target: null,
    title: "Tudo pronto!",
    content: "Use o menu ao lado para acessar usuários, turmas, matrículas, configurações do site e demais funções. Bom trabalho!",
  },
];

/** Passos do tutorial exibido ao Professor na primeira vez no /dashboard */
const TEACHER_TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: "[data-tour=\"teacher-dashboard-welcome\"]",
    title: "Dashboard Professor",
    content:
      "Visão geral das suas turmas e alunos. O painel inicial é leve; detalhes de gamificação, ranking, fórum e calendário ficam em páginas próprias.",
  },
  {
    target: "[data-tour=\"teacher-dashboard-resumo\"]",
    title: "Seu resumo",
    content: "Turmas ativas (abertas ou em andamento), total de alunos matriculados nas suas turmas e vagas ainda disponíveis.",
  },
  {
    target: "[data-tour=\"teacher-dashboard-detalhes\"]",
    title: "Acompanhamento detalhado",
    content:
      "Abra Acompanhamento completo para gamificação, engajamento por turma, ranking dos alunos, avaliações e fórum. Use Calendário de aulas para sessões e feriados em outra página.",
  },
  {
    target: "[data-tour=\"teacher-dashboard-turmas\"]",
    title: "Suas turmas",
    content:
      "Coluna Turma com curso, local, dias da semana e horário. Use Matrículas ou Painel para acessar matrículas, sessões, presenças e conteúdo.",
  },
  {
    target: "[data-tour=\"teacher-dashboard-atalhos\"]",
    title: "Atalhos",
    content: "Links rápidos: Turmas que leciono (sessões e presenças), Matrículas e Alunos. O menu lateral também dá acesso a todas as áreas.",
  },
  {
    target: null,
    title: "Tudo pronto!",
    content: "Use o menu ao lado para acessar suas turmas, alunos e o que precisar. Bom trabalho!",
  },
];

function formatDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = pad(d.getUTCDate());
  const cal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const month = cal.toLocaleDateString("pt-BR", { month: "short" });
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function TeacherTurmaCell({ cg }: { cg: ClassGroupSummary }) {
  const days = formatDaysShortPtBr(cg.daysOfWeek);
  const time =
    cg.startTime && cg.endTime ? `${cg.startTime}–${cg.endTime}` : "—";
  return (
    <div className="min-w-0 max-w-md">
      <Link
        href={`/enrollments?turma=${cg.id}`}
        className="font-semibold text-[var(--text-primary)] hover:text-[var(--igh-primary)] hover:underline"
      >
        {cg.courseName}
      </Link>
      {cg.location?.trim() ? (
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          <span className="text-[var(--text-muted)]">Local:</span> {cg.location.trim()}
        </p>
      ) : null}
      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
        <span className="text-[var(--text-muted)]">Dias:</span> {days}
        <span className="mx-1 text-[var(--text-muted)]">·</span>
        <span className="text-[var(--text-muted)]">Horário:</span> {time}
      </p>
    </div>
  );
}

function DashboardAdmin({
  data,
  userName,
  readOnly = false,
}: {
  data: DashboardDataAdmin;
  userName: string;
  /** Coordenador: sem atalhos para campanhas ou edição do site. */
  readOnly?: boolean;
}) {
  const { stats, roleLabel } = data;
  const firstName = userName?.split(/\s+/)[0] ?? "Admin";

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        dataTour="admin-dashboard-welcome"
        eyebrow={readOnly ? "Coordenação" : "Painel administrativo"}
        title={`Olá, ${firstName}`}
        description={
          <>
            {readOnly
              ? "Acompanhamento do sistema em modo somente leitura — totais e atalhos para consulta. Engajamento, rankings, fórum e calendário carregam nas páginas dedicadas."
              : "Resumo leve ao entrar: totais de pessoas e operação. Indicadores de engajamento, rankings, avaliações, fórum e calendário institucional só carregam quando você abre essas páginas."}
            <span className="mt-2 block text-xs font-medium text-[var(--text-muted)]">
              Perfil: <span className="text-[var(--text-primary)]">{roleLabel}</span>
            </span>
          </>
        }
      />

      <section data-tour="admin-dashboard-resumo" aria-label="Resumo geral">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Alunos" icon={GraduationCap} value={stats.students} href="/students" accent="violet" />
          <StatTile label="Professores" icon={Users2} value={stats.teachers} href="/teachers" accent="sky" />
          <StatTile label="Cursos" icon={BookOpen} value={stats.courses} href="/courses" accent="emerald" />
          <StatTile label="Turmas" icon={School} value={stats.classGroups} href="/class-groups" accent="amber" />
          <StatTile
            label="Matrículas"
            icon={UserPlus}
            value={stats.enrollments}
            href="/enrollments"
            accent="rose"
            sublabel={
              stats.preEnrollments > 0
                ? `${stats.preEnrollments} pré-matrículas · ${stats.confirmedEnrollments} confirmadas`
                : `${stats.confirmedEnrollments} confirmadas`
            }
          />
        </div>
      </section>

      <SectionCard
        title="Visão da plataforma"
        description="Engajamento global, rankings de professores e alunos, avaliações, trilho de fóruns e últimos acessos — em uma página. Calendário de sessões e feriados em outra."
        id="admin-detalhes-heading"
        dataTour="admin-dashboard-detalhes"
        variant="elevated"
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/plataforma"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
          >
            <Trophy className="h-4 w-4 text-amber-600" aria-hidden />
            Visão da plataforma
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/admin/calendario"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
          >
            <CalendarDays className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            Calendário institucional
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </SectionCard>

      <section data-tour="admin-dashboard-atalhos">
          <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">O que você precisa agora?</h2>
          <p className="mb-4 max-w-2xl text-sm text-[var(--text-muted)]">
            Atalhos para as tarefas mais comuns — comunicação, pessoas e operação acadêmica.
          </p>
          <QuickActionGrid
            items={[
              {
                href: "/enrollments",
                label: "Matrículas",
                description: readOnly ? "Consultar matrículas e turmas" : "Confirmar, filtrar e acompanhar turmas",
                icon: UserPlus,
                accent: "from-emerald-500 to-teal-600",
              },
              {
                href: "/students",
                label: "Alunos",
                description: readOnly ? "Listagem e dados dos estudantes" : "Cadastros e perfis de estudantes",
                icon: GraduationCap,
                accent: "from-violet-500 to-purple-700",
              },
              {
                href: "/teachers",
                label: "Professores",
                description: readOnly ? "Corpo docente (consulta)" : "Corpo docente e vínculos",
                icon: Users2,
                accent: "from-sky-500 to-blue-700",
              },
              {
                href: "/courses",
                label: "Cursos",
                description: readOnly ? "Catálogo e carga horária" : "Conteúdo e estrutura pedagógica",
                icon: BookOpen,
                accent: "from-amber-500 to-orange-600",
              },
              {
                href: "/class-groups",
                label: "Turmas",
                description: readOnly ? "Ofertas e calendário (consulta)" : "Ofertas, calendário e vagas",
                icon: School,
                accent: "from-rose-500 to-red-600",
              },
              ...(readOnly
                ? []
                : [
                    {
                      href: "/admin/email",
                      label: "E-mail em massa",
                      description: "Campanhas e disparos para a base",
                      icon: Mail,
                      accent: "from-indigo-500 to-violet-700",
                    },
                  ]),
              {
                href: "/admin/forum",
                label: "Fóruns (todos os cursos)",
                description: "Discussões por aula — visão global da comunidade",
                icon: MessageCircle,
                accent: "from-sky-500 to-indigo-600",
              },
              {
                href: "/gamificacao",
                label: "Gamificação",
                description: "Ranking e engajamento dos professores",
                icon: Trophy,
                accent: "from-amber-400 to-yellow-600",
              },
              {
                href: "/admin/avaliacoes-experiencia",
                label: "Avaliações",
                description: "Feedback dos alunos sobre a experiência",
                icon: PieChart,
                accent: "from-cyan-500 to-emerald-600",
              },
              {
                href: "/master/acessos",
                label: "Acessos ao sistema",
                description: "Últimos logins e páginas visitadas (área logada)",
                icon: ListChecks,
                accent: "from-slate-600 to-zinc-800",
              },
              ...(readOnly
                ? []
                : [
                    {
                      href: "/admin/site/configuracoes",
                      label: "Site & configurações",
                      description: "Institucional, banners e ajustes",
                      icon: LayoutDashboard,
                      accent: "from-slate-500 to-slate-700",
                    },
                  ]),
              ...(readOnly
                ? [
                    {
                      href: "/horarios",
                      label: "Quadro de horários",
                      description: "Visão consolidada de turmas e horários",
                      icon: Clock,
                      accent: "from-blue-500 to-cyan-600",
                    },
                    {
                      href: "/admin/frequencia",
                      label: "Frequência",
                      description: "Presenças por turma (todas as turmas)",
                      icon: ListChecks,
                      accent: "from-emerald-500 to-teal-700",
                    },
                  ]
                : []),
            ]}
          />
        </section>
    </div>
  );
}

function DashboardTeacher({
  data,
  userName,
}: {
  data: Extract<DashboardData, { role: "TEACHER" }>;
  userName: string;
}) {
  const { myClassGroupsCount, myEnrollmentsCount, classGroups, roleLabel } = data;
  const totalVagasDisponiveis = classGroups.reduce(
    (acc, cg) => acc + Math.max(0, (cg.capacity ?? 0) - (cg.enrollmentsCount ?? 0)),
    0
  );
  const firstName = userName?.split(/\s+/)[0] ?? "Professor";

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        dataTour="teacher-dashboard-welcome"
        eyebrow="Área do professor"
        title={`Bem-vindo, ${firstName}`}
        description={
          <>
            Resumo leve ao entrar: turmas, matrículas e atalhos. Gamificação, engajamento por turma, ranking dos alunos,
            avaliações e calendário de aulas carregam só nas páginas dedicadas — quando você abre.
            <span className="mt-2 block text-xs font-medium text-[var(--text-muted)]">
              Perfil: <span className="text-[var(--text-primary)]">{roleLabel}</span>
            </span>
          </>
        }
      />

      <section data-tour="teacher-dashboard-resumo" aria-label="Resumo das suas turmas">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Turmas ativas"
            icon={School}
            value={myClassGroupsCount}
            href="/professor/turmas"
            accent="amber"
            sublabel="Abertas ou em andamento"
          />
          <StatTile
            label="Alunos matriculados"
            icon={Users}
            value={myEnrollmentsCount}
            href="/enrollments"
            accent="emerald"
            sublabel="Nas suas turmas"
          />
          <StatTile
            label="Vagas disponíveis"
            icon={UserPlus}
            value={totalVagasDisponiveis}
            accent="sky"
            sublabel="Capacidade ainda não preenchida"
          />
        </div>
      </section>

      <SectionCard
        title="Detalhes de acompanhamento"
        description="Gamificação, engajamento por turma, ranking dos seus alunos, avaliações e atividade no fórum — em uma página. Calendário de sessões e feriados em outra."
        id="teacher-detalhes-heading"
        dataTour="teacher-dashboard-detalhes"
        variant="elevated"
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/professor/acompanhamento"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
          >
            <Trophy className="h-4 w-4 text-amber-600" aria-hidden />
            Acompanhamento completo
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/professor/calendario"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
          >
            <CalendarDays className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            Calendário de aulas
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </SectionCard>

      <section data-tour="teacher-dashboard-turmas" className="flex min-h-0 min-w-0 flex-col">
        <SectionCard
          title="Suas turmas no ar"
          description="Abertas ou em andamento — presenças, sessões e conteúdo a um clique."
          id="teacher-turmas-heading"
          className="min-h-0 flex-1"
          action={
            <Link
              href="/professor/turmas"
              className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
            >
              Ver todas →
            </Link>
          }
        >
          {classGroups.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma turma aberta ou em andamento no momento.</p>
          ) : (
            <TableShell>
              <thead>
                <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/90 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Turma</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Vagas</th>
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {classGroups.map((cg) => (
                  <tr key={cg.id} className="transition hover:bg-[var(--igh-surface)]/40">
                    <td className="border-b border-[var(--card-border)] px-4 py-3 align-top">
                      <TeacherTurmaCell cg={cg} />
                    </td>
                    <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">
                      {cg.enrollmentsCount} / {cg.capacity}
                    </td>
                    <td className="border-b border-[var(--card-border)] px-4 py-3 align-top">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/professor/turmas/${cg.id}`}
                          className="rounded-md bg-[var(--igh-primary)]/10 px-2 py-1 text-xs font-bold text-[var(--igh-primary)] hover:bg-[var(--igh-primary)]/20"
                        >
                          Painel
                        </Link>
                        <Link
                          href={`/enrollments?turma=${cg.id}`}
                          className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--igh-primary)] hover:underline"
                        >
                          Matrículas
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </SectionCard>
      </section>

      <section data-tour="teacher-dashboard-atalhos">
          <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">Atalhos do professor</h2>
          <QuickActionGrid
            items={[
              {
                href: "/professor/turmas",
                label: "Turmas que leciono",
                description: "Sessões, presenças e conteúdo",
                icon: School,
                accent: "from-amber-500 to-orange-600",
              },
              {
                href: "/professor/forum",
                label: "Fórum dos cursos",
                description: "Dúvidas por aula — todas as turmas do curso",
                icon: MessageCircle,
                accent: "from-sky-500 to-cyan-700",
              },
              {
                href: "/gamificacao",
                label: "Gamificação",
                description: "Sua pontuação e ranking",
                icon: Trophy,
                accent: "from-yellow-500 to-amber-700",
              },
              {
                href: "/enrollments",
                label: "Matrículas",
                description: "Alunos por turma",
                icon: UserPlus,
                accent: "from-emerald-500 to-teal-600",
              },
              {
                href: "/students",
                label: "Alunos",
                description: "Consulta rápida de cadastros",
                icon: GraduationCap,
                accent: "from-violet-500 to-purple-700",
              },
              {
                href: "/professor/avaliacoes-experiencia",
                label: "Avaliações",
                description: "Feedback dos seus alunos",
                icon: PieChart,
                accent: "from-cyan-500 to-blue-600",
              },
            ]}
          />
        </section>
    </div>
  );
}

function CourseCard({ enrollment }: { enrollment: StudentEnrollmentSummary }) {
  const percent =
    enrollment.lessonsTotal > 0
      ? Math.round((enrollment.lessonsCompleted / enrollment.lessonsTotal) * 100)
      : 0;
  const hasProgress = enrollment.lessonsTotal > 0;
  const isComplete = hasProgress && enrollment.lessonsCompleted >= enrollment.lessonsTotal;

  return (
    <Link
      href={`/minhas-turmas/${enrollment.id}/conteudo`}
      className="group flex flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm ring-1 ring-black/[0.02] transition duration-300 hover:-translate-y-1 hover:border-[var(--igh-primary)]/45 hover:shadow-lg hover:shadow-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 dark:ring-white/[0.03]"
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--igh-primary)]/20 to-violet-500/15 text-[var(--igh-primary)] shadow-inner">
              <BookOpen className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--igh-primary)]">
                {enrollment.courseName}
              </h3>
              <p className="mt-1 text-xs font-normal text-[var(--text-muted)]/85">
                Prof. {enrollment.teacherName}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--igh-primary)]" aria-hidden />
        </div>
        {hasProgress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Progresso</span>
              <span className="font-medium text-[var(--text-primary)]">
                {enrollment.lessonsCompleted} / {enrollment.lessonsTotal} aulas
                {percent > 0 && ` · ${percent}%`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--igh-surface)]">
              <div
                className="h-full rounded-full bg-[var(--igh-primary)] transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
        <p className="mt-auto text-sm font-medium text-[var(--igh-primary)]">
          {isComplete ? "Curso concluído" : hasProgress ? "Abrir conteúdo" : "Começar o curso"}
        </p>
      </div>
    </Link>
  );
}

/** Bandeira quadriculada de chegada — marca o fim da barra de progresso. */
function FinishLineFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      {/* mastro */}
      <path
        d="M4 22V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-[var(--text-muted)]"
      />
      {/* tecido xadrez 4×3 (bandeira de chegada) */}
      <g className="dark:invert">
        <rect x="6" y="4" width="16" height="12" rx="1" fill="#18181b" />
        <rect x="6" y="4" width="4" height="4" fill="#fafafa" />
        <rect x="14" y="4" width="4" height="4" fill="#fafafa" />
        <rect x="10" y="8" width="4" height="4" fill="#fafafa" />
        <rect x="18" y="8" width="4" height="4" fill="#fafafa" />
        <rect x="6" y="12" width="4" height="4" fill="#fafafa" />
        <rect x="14" y="12" width="4" height="4" fill="#fafafa" />
      </g>
    </svg>
  );
}

function DashboardStudent({
  userName,
  data,
}: {
  userName: string;
  data: Extract<DashboardData, { role: "STUDENT" }>;
}) {
  const {
    enrollments,
    activeEnrollmentsCount,
    totalLessonsCompleted,
    totalLessonsTotal,
    recommendedEnrollmentId,
    lastViewedLesson,
  } = data;
  const firstName = userName?.split(/\s+/)[0] ?? "Aluno";
  const recommendedEnrollment = recommendedEnrollmentId
    ? enrollments.find((e) => e.id === recommendedEnrollmentId)
    : null;
  const continueLink = lastViewedLesson
    ? `/minhas-turmas/${lastViewedLesson.enrollmentId}/conteudo/aula/${lastViewedLesson.lessonId}${
        lastViewedLesson.lastContentPageIndex != null ? `?pagina=${lastViewedLesson.lastContentPageIndex + 1}` : ""
      }#conteudo`
    : recommendedEnrollment
      ? `/minhas-turmas/${recommendedEnrollment.id}/conteudo`
      : null;
  const continueLabel = lastViewedLesson
    ? lastViewedLesson.lessonTitle
    : recommendedEnrollment
      ? recommendedEnrollment.courseName
      : null;
  const continueSublabel = lastViewedLesson
    ? lastViewedLesson.courseName
    : recommendedEnrollment
      ? `${recommendedEnrollment.lessonsCompleted} de ${recommendedEnrollment.lessonsTotal} aulas${
          recommendedEnrollment.lessonsTotal > 0
            ? ` · ${Math.round((recommendedEnrollment.lessonsCompleted / recommendedEnrollment.lessonsTotal) * 100)}%`
            : ""
        }`
      : null;
  const globalPercent =
    totalLessonsTotal > 0 ? Math.round((totalLessonsCompleted / totalLessonsTotal) * 100) : 0;

  const continueBlock =
    enrollments.length > 0 && continueLink && continueLabel ? (
      <section aria-labelledby="continuar-heading">
        <h2 id="continuar-heading" className="sr-only">
          Continuar de onde parou
        </h2>
        <Link
          href={continueLink}
          className="group relative flex min-h-[100px] flex-wrap items-center gap-4 overflow-hidden rounded-2xl border-2 border-[var(--igh-primary)]/35 bg-gradient-to-br from-[var(--igh-primary)]/12 via-[var(--card-bg)] to-violet-500/10 p-4 shadow-md shadow-[var(--igh-primary)]/10 transition hover:border-[var(--igh-primary)]/55 hover:shadow-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:p-5"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--igh-primary)]/20 blur-3xl" aria-hidden />
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--igh-primary)] text-white shadow-md shadow-[var(--igh-primary)]/30">
            <PlayCircle className="h-6 w-6" aria-hidden />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--igh-primary)]">Continuar de onde parou</p>
            <p className="mt-0.5 text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--igh-primary)] sm:text-lg">
              {continueLabel}
            </p>
            {continueSublabel && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">{continueSublabel}</p>
            )}
          </div>
          <ChevronRight className="relative h-5 w-5 shrink-0 text-[var(--igh-primary)] transition group-hover:translate-x-1" aria-hidden />
        </Link>
      </section>
    ) : (
      <div className="rounded-2xl border border-dashed border-[var(--igh-border)] bg-[var(--igh-surface)]/50 p-4 text-sm text-[var(--text-muted)] sm:p-5">
        {enrollments.length === 0 ? (
          <>
            Matricule-se em um curso para ver o atalho <strong className="text-[var(--text-primary)]">Continuar de onde parou</strong> aqui.
          </>
        ) : (
          <>
            Abra uma aula em <strong className="text-[var(--text-primary)]">Minhas turmas</strong> para ver o atalho aqui.
          </>
        )}
      </div>
    );

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        dataTour="dashboard-welcome"
        eyebrow="Sua jornada de aprendizado"
        title={`Olá, ${firstName}!`}
        description="Resumo leve ao entrar: continue de onde parou, veja seu progresso geral e acesse rapidamente turmas e fórum. Detalhes de pontos, ranking, exercícios e calendário ficam em páginas próprias — só carregam quando você abre."
        rightSlot={
          <StudentPlatformExperienceModal
            autoPromptOnce={enrollments.length > 0}
            className="w-full sm:w-auto"
          />
        }
      />

      <div className="min-w-0">{continueBlock}</div>

      {enrollments.length > 0 && (
        <SectionCard
          title="Seu progresso"
          description="Visão geral do percurso. O detalhe por curso (aulas, exercícios, frequência, fórum) está em Minhas turmas; evolução e ranking em outra página."
          id="resumo-progresso-heading"
          dataTour="dashboard-progresso-geral"
          variant="elevated"
        >
          {totalLessonsTotal > 0 ? (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="text-5xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">
                  {totalLessonsCompleted}
                </span>
                <span className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                  de {totalLessonsTotal} aulas concluídas
                </span>
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--igh-surface)] shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--igh-primary)] to-violet-500 transition-all duration-500"
                      style={{ width: `${globalPercent}%` }}
                    />
                  </div>
                  <span
                    className="inline-flex shrink-0"
                    title="Chegada — fim do percurso do curso"
                    role="img"
                    aria-label="Chegada, linha de chegada do percurso"
                  >
                    <FinishLineFlagIcon className="h-5 w-5 text-[var(--igh-primary)]" />
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--igh-primary)]">{globalPercent}% do percurso total</p>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              Ainda não há aulas cadastradas nos módulos dos seus cursos. Quando o conteúdo for publicado, seu percurso e as
              barras de progresso aparecem aqui.
            </p>
          )}
          <div
            className="mt-6 flex flex-wrap gap-2 border-t border-[var(--card-border)] pt-6"
            data-tour="dashboard-detalhes-engajamento"
          >
            <Link
              href="/minhas-turmas"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
            >
              Ver detalhe por curso
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/minhas-turmas/evolucao"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
            >
              <Trophy className="h-4 w-4 text-amber-600" aria-hidden />
              Evolução, ranking e fórum
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/minhas-turmas/calendario"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
            >
              <CalendarDays className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
              Calendário de aulas
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </SectionCard>
      )}

      {enrollments.length > 0 ? (
        <>
          <section aria-labelledby="cursos-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="cursos-heading" className="text-xl font-bold text-[var(--text-primary)]">
                  Seus cursos
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Toque em um card para abrir o conteúdo e acompanhar o desempenho.
                </p>
              </div>
              <span className="rounded-full bg-[var(--igh-surface)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {activeEnrollmentsCount === 1
                  ? "1 matrícula ativa"
                  : `${activeEnrollmentsCount} matrículas ativas`}
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((e) => (
                <CourseCard key={e.id} enrollment={e} />
              ))}
            </div>
            <div className="mt-6">
              <Link
                href="/minhas-turmas"
                className="inline-flex items-center gap-1 text-sm font-bold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
              >
                Ver todas as turmas
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--igh-primary)]/25 bg-gradient-to-b from-[var(--igh-surface)]/80 to-[var(--card-bg)] px-6 py-16 text-center shadow-inner"
          aria-label="Nenhum curso"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--igh-primary)]/15 text-[var(--igh-primary)] ring-4 ring-[var(--igh-primary)]/10">
            <GraduationCap className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mt-6 text-lg font-bold text-[var(--text-primary)]">
            Sua jornada começa em breve
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
            Quando você for matriculado em um curso, ele aparecerá aqui com progresso, exercícios e atalhos personalizados.
          </p>
          <Link
            href="/minhas-turmas"
            className="mt-6 rounded-xl bg-[var(--igh-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[var(--igh-primary)]/25 transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            Ver minhas turmas
          </Link>
        </section>
      )}

      <section className="mt-4" aria-labelledby="atalhos-heading">
        <h2 id="atalhos-heading" className="mb-1 text-lg font-bold text-[var(--text-primary)]">
          Acesso rápido
        </h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">O que você usa com mais frequência, a um toque.</p>
        <QuickActionGrid
          items={[
            {
              href: "/minhas-turmas",
              label: "Minhas turmas",
              description: "Cursos, aulas e progresso",
              icon: BookOpen,
              accent: "from-[var(--igh-primary)] to-violet-600",
              dataTour: "dashboard-acesso-minhas-turmas",
            },
            {
              href: "/minhas-turmas/evolucao",
              label: "Evolução e ranking",
              description: "Pontos, conquistas, ranking e fórum",
              icon: Trophy,
              accent: "from-amber-500 to-rose-600",
            },
            {
              href: "/minhas-turmas/calendario",
              label: "Calendário de aulas",
              description: "Sessões, feriados e eventos",
              icon: CalendarDays,
              accent: "from-violet-500 to-fuchsia-600",
            },
            {
              href: "/minhas-turmas/forum",
              label: "Fórum dos cursos",
              description: "Discussões por aula com toda a turma do curso",
              icon: MessageCircle,
              accent: "from-sky-500 to-indigo-600",
            },
            {
              href: "/minhas-turmas/favoritos",
              label: "Favoritos",
              description: "Aulas salvas para revisar",
              icon: Star,
              accent: "from-amber-500 to-orange-600",
              dataTour: "dashboard-acesso-favoritos",
            },
            {
              href: "/meus-dados",
              label: "Meus dados",
              description: "Cadastro e documentos",
              icon: UserCircle,
              accent: "from-emerald-500 to-teal-600",
              dataTour: "dashboard-acesso-meus-dados",
            },
          ]}
        />
      </section>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireSessionUser();
  let data: DashboardData;
  try {
    data = await getDashboardData(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isConnectionError =
      message.includes("connect") ||
      message.includes("upstream") ||
      message.includes("ECONNREFUSED") ||
      message.includes("connection");

    return (
      <div className="flex min-w-0 flex-col">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
            Não foi possível carregar o painel
          </h2>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            {isConnectionError
              ? "Falha na conexão com o banco de dados. Verifique se o servidor está rodando e se as variáveis APP_DATABASE_URL (runtime) e APP_DIRECT_URL (migrations) estão corretas."
              : "Ocorreu um erro ao buscar os dados."}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Se o problema continuar, confira a conexão (PostgreSQL) e as credenciais no .env.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {data.role === "ADMIN" || data.role === "MASTER" || data.role === "COORDINATOR" ? (
        <DashboardAdmin
          data={data}
          userName={user.name}
          readOnly={data.role === "COORDINATOR"}
        />
      ) : data.role === "TEACHER" ? (
        <DashboardTeacher data={data} userName={user.name} />
      ) : (
        <DashboardStudent
          userName={user.name}
          data={data as Extract<DashboardData, { role: "STUDENT" }>}
        />
      )}
      <DashboardTutorial
        showForStudent={
          data.role !== "MASTER" &&
          (data.role === "STUDENT" ||
            data.role === "ADMIN" ||
            data.role === "COORDINATOR" ||
            data.role === "TEACHER")
        }
        steps={
          data.role === "STUDENT"
            ? STUDENT_TUTORIAL_STEPS
            : data.role === "ADMIN" || data.role === "MASTER" || data.role === "COORDINATOR"
              ? ADMIN_TUTORIAL_STEPS
              : data.role === "TEACHER"
                ? TEACHER_TUTORIAL_STEPS
                : []
        }
        storageKey={
          data.role === "ADMIN" || data.role === "MASTER" || data.role === "COORDINATOR"
            ? "admin-dashboard-tutorial-done"
            : data.role === "TEACHER"
              ? "teacher-dashboard-tutorial-done"
              : undefined
        }
      />
    </>
  );
}
