import type { ReactNode } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  Flame,
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

import { DashboardForumActivityRail } from "@/components/dashboard/DashboardForumActivityRail";
import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import {
  DashboardHero,
  QuickActionGrid,
  SectionCard,
  StatTile,
  StatusBars,
  TableShell,
} from "@/components/dashboard/DashboardUI";
import { StudentPlatformExperienceModal } from "@/components/student/StudentPlatformExperienceModal";
import { requireSessionUser } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardData,
  type DashboardDataAdmin,
  type ClassGroupSummary,
  type PlatformExperienceDashboardSummary,
  type StudentEnrollmentSummary,
} from "@/lib/dashboard-data";
import type { TeacherGamificationResult } from "@/lib/teacher-gamification";
import { EXERCISES_TARGET_PER_LESSON, GAMIFICATION_POINTS } from "@/lib/teacher-gamification";

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
    content: "Aqui aparece quantas aulas você já concluiu no total e a barra de progresso. Conclua as aulas para avançar nos cursos.",
  },
  {
    target: "[data-tour=\"dashboard-desempenho-exercicios\"]",
    title: "Desempenho nos exercícios",
    content: "Após responder às questões ao final das aulas, você vê aqui seus acertos e a porcentagem. Use o link para ver por curso e revisar tópicos que precisam de atenção.",
  },
  {
    target: "[data-tour=\"dashboard-sua-evolucao\"]",
    title: "Sua evolução",
    content:
      "Você ganha pontos ao concluir aulas, realizar exercícios, manter frequência e participar das dúvidas no fórum. Suba de nível (Iniciante, Explorador, Dedicado...) e desbloqueie conquistas ao longo da jornada.",
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
    content: "Visão geral do sistema. Aqui você acompanha alunos, professores, cursos, turmas e matrículas.",
  },
  {
    target: "[data-tour=\"admin-dashboard-resumo\"]",
    title: "Resumo geral",
    content: "Cards com totais de Alunos, Professores, Cursos, Turmas e Matrículas. Clique em cada um para ir à página correspondente.",
  },
  {
    target: "[data-tour=\"admin-dashboard-turmas-status\"]",
    title: "Turmas por status",
    content: "Quantidade de turmas em cada status: Aberta, Em andamento, Planejada, Encerrada, Cancelada e Interno.",
  },
  {
    target: "[data-tour=\"admin-dashboard-matriculas-30\"]",
    title: "Matrículas (últimos 30 dias)",
    content: "Total de matrículas nos últimos 30 dias. Use o link para ver todas as matrículas.",
  },
  {
    target: "[data-tour=\"admin-dashboard-turmas-abertas\"]",
    title: "Turmas abertas ou em andamento",
    content: "Tabela com as turmas que estão abertas ou em andamento. Acesse turmas e matrículas por curso a partir daqui.",
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
    content: "Visão geral das suas turmas e alunos. Aqui você acompanha turmas ativas, matrículas e atalhos para o dia a dia.",
  },
  {
    target: "[data-tour=\"teacher-dashboard-resumo\"]",
    title: "Seu resumo",
    content: "Turmas ativas (abertas ou em andamento), total de alunos matriculados nas suas turmas e vagas ainda disponíveis.",
  },
  {
    target: "[data-tour=\"teacher-dashboard-turmas\"]",
    title: "Suas turmas",
    content: "Tabela com as turmas que você leciona. Clique no curso para ver as matrículas ou use \"Ver turma\" para acessar sessões, presenças e conteúdo da turma.",
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

const POINTS_PER_LESSON = 10;
const LEVELS = [
  { min: 0, name: "Iniciante", max: 49 },
  { min: 50, name: "Explorador", max: 149 },
  { min: 150, name: "Dedicado", max: 299 },
  { min: 300, name: "Expert", max: 499 },
  { min: 500, name: "Mestre", max: Infinity },
] as const;

function getLevel(points: number) {
  const level = LEVELS.find((l) => points >= l.min && points <= l.max) ?? LEVELS[0];
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  const progressInLevel = next
    ? (points - level.min) / (next.min - level.min)
    : 1;
  return { ...level, progressInLevel, next };
}

type BadgeId = "primeira-aula" | "5-aulas" | "10-aulas" | "25-aulas" | "50-aulas" | "curso-concluido" | "multiplos-cursos";
const BADGES: { id: BadgeId; label: string; condition: (data: { total: number; completed: number; enrollments: { lessonsTotal: number; lessonsCompleted: number }[] }) => boolean }[] = [
  { id: "primeira-aula", label: "Primeira aula", condition: (d) => d.completed >= 1 },
  { id: "5-aulas", label: "5 aulas concluídas", condition: (d) => d.completed >= 5 },
  { id: "10-aulas", label: "10 aulas concluídas", condition: (d) => d.completed >= 10 },
  { id: "25-aulas", label: "25 aulas concluídas", condition: (d) => d.completed >= 25 },
  { id: "50-aulas", label: "50 aulas concluídas", condition: (d) => d.completed >= 50 },
  { id: "curso-concluido", label: "Curso concluído", condition: (d) => d.enrollments.some((e) => e.lessonsTotal > 0 && e.lessonsCompleted >= e.lessonsTotal) },
  { id: "multiplos-cursos", label: "Múltiplos cursos", condition: (d) => d.enrollments.length >= 2 },
];

function formatDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = pad(d.getUTCDate());
  const cal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const month = cal.toLocaleDateString("pt-BR", { month: "short" });
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function ClassGroupRow({ cg }: { cg: ClassGroupSummary }) {
  const vacancy = cg.capacity - cg.enrollmentsCount;
  return (
    <tr className="transition hover:bg-[var(--igh-surface)]/40">
      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-primary)]">
        <Link href={`/enrollments?turma=${cg.id}`} className="font-semibold hover:text-[var(--igh-primary)] hover:underline">
          {cg.courseName}
        </Link>
      </td>
      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">{cg.teacherName}</td>
      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">
        {STATUS_LABELS[cg.status] ?? cg.status}
      </td>
      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">
        {formatDate(cg.startDate)}
      </td>
      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">
        {cg.enrollmentsCount} / {cg.capacity}
        {vacancy > 0 && <span className="ml-1 text-[var(--text-muted)]">({vacancy} vagas)</span>}
      </td>
    </tr>
  );
}

function TeacherGamificationPanel({ g }: { g: TeacherGamificationResult }) {
  const p = g.points;
  const cards: {
    title: string;
    value: number;
    unit: string;
    icon: ReactNode;
    accent: string;
  }[] = [
    {
      title: "Conteúdo nas aulas",
      value: p.content,
      unit: "pts",
      icon: <BookOpen className="h-5 w-5" aria-hidden />,
      accent: "from-amber-500/20 to-orange-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      title: `Exercícios nas aulas (${EXERCISES_TARGET_PER_LESSON})`,
      value: p.exercises,
      unit: "pts",
      icon: <ClipboardList className="h-5 w-5" aria-hidden />,
      accent: "from-violet-500/20 to-purple-500/10 text-violet-700 dark:text-violet-300",
    },
    {
      title: "Frequência dos alunos",
      value: p.attendance,
      unit: "pts",
      icon: <Users className="h-5 w-5" aria-hidden />,
      accent: "from-emerald-500/20 to-teal-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      title: "Participações nos fóruns (prof. e alunos)",
      value: p.forum,
      unit: "pts",
      icon: <MessageCircle className="h-5 w-5" aria-hidden />,
      accent: "from-sky-500/20 to-blue-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      title: "Aulas assistidas",
      value: p.studentWatchHours,
      unit: "horas",
      icon: <Clock className="h-5 w-5" aria-hidden />,
      accent: "from-rose-500/20 to-pink-500/10 text-rose-700 dark:text-rose-300",
    },
    {
      title: "Exercícios realizados",
      value: p.studentExerciseScore,
      unit: "pts",
      icon: <ListChecks className="h-5 w-5" aria-hidden />,
      accent: "from-indigo-500/20 to-violet-500/10 text-indigo-700 dark:text-indigo-300",
    },
  ];

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-[var(--card-bg)] to-violet-50/40 p-5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/35 dark:via-[var(--card-bg)] dark:to-violet-950/25 sm:p-6"
      data-tour="teacher-gamification"
      aria-labelledby="teacher-gamification-heading"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-500/10"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="teacher-gamification-heading"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/25">
              <Trophy className="h-5 w-5" aria-hidden />
            </span>
            Sua gamificação
          </h2>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{p.total}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Pontuação total</p>
        </div>
        <Link
          href="/gamificacao"
          className="shrink-0 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/80 px-4 py-2 text-sm font-medium text-[var(--igh-primary)] shadow-sm backdrop-blur-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          Ranking completo →
        </Link>
      </div>

      <ul className="relative mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li
            key={c.title}
            className="group rounded-xl border border-[var(--card-border)]/80 bg-[var(--card-bg)]/70 p-4 shadow-sm backdrop-blur-md transition duration-200 hover:border-amber-300/50 hover:shadow-md dark:border-white/10 dark:bg-black/20 dark:hover:border-amber-700/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 text-xs font-semibold uppercase leading-snug tracking-wide text-[var(--text-muted)]">
                {c.title}
              </h3>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.accent}`}
              >
                {c.icon}
              </div>
            </div>
            <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{c.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]/90">{c.unit}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlatformExperienceSummarySection({
  summary,
  href,
  title,
  description,
}: {
  summary: PlatformExperienceDashboardSummary;
  href: string;
  title: string;
  description: string;
}) {
  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(1));
  return (
    <SectionCard
      title={title}
      description={description}
      id="platform-exp-summary-heading"
      variant="elevated"
      action={
        <Link
          href={href}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--igh-primary)] transition hover:bg-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          Ver detalhes →
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Respostas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{summary.totalCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Plataforma</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fmt(summary.avgPlatform)}
            <span className="text-sm font-normal text-[var(--text-muted)]">/10</span>
          </p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Aulas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fmt(summary.avgLessons)}
            <span className="text-sm font-normal text-[var(--text-muted)]">/10</span>
          </p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Professor</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fmt(summary.avgTeacher)}
            <span className="text-sm font-normal text-[var(--text-muted)]">/10</span>
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function DashboardAdmin({ data, userName }: { data: DashboardDataAdmin; userName: string }) {
  const {
    stats,
    recentEnrollmentsCount,
    openClassGroups,
    roleLabel,
    teachersGamificationRanking,
    platformExperienceSummary,
  } = data;
  const statusOrder = ["ABERTA", "EM_ANDAMENTO", "PLANEJADA", "ENCERRADA", "CANCELADA", "INTERNO", "EXTERNO"] as const;
  const firstName = userName?.split(/\s+/)[0] ?? "Admin";
  const maxStatus = Math.max(1, ...statusOrder.map((s) => stats.classGroupsByStatus[s] ?? 0));
  const statusRows = statusOrder.map((status) => ({
    label: STATUS_LABELS[status],
    value: stats.classGroupsByStatus[status] ?? 0,
    tone:
      status === "ABERTA" || status === "EM_ANDAMENTO"
        ? ("success" as const)
        : status === "PLANEJADA"
          ? ("warning" as const)
          : status === "ENCERRADA" || status === "CANCELADA"
            ? ("muted" as const)
            : ("default" as const),
  }));

  return (
    <div className="min-w-0">
        <DashboardHero
          dataTour="admin-dashboard-welcome"
          eyebrow="Painel administrativo"
          title={`Olá, ${firstName}`}
          description={
            <>
              Visão executiva do sistema — pessoas, turmas, matrículas e engajamento em um só lugar.
              <span className="mt-2 block text-xs font-medium text-[var(--text-muted)]">
                Perfil: <span className="text-[var(--text-primary)]">{roleLabel}</span>
              </span>
            </>
          }
        />

        <section className="mt-2" data-tour="admin-dashboard-resumo" aria-label="Resumo geral">
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Turmas por status"
            description="Distribuição do seu portfólio de turmas — identifique gargalos e oportunidades."
            id="admin-turmas-status-heading"
            dataTour="admin-dashboard-turmas-status"
          >
            <StatusBars rows={statusRows} max={maxStatus} />
          </SectionCard>
          <SectionCard
            title="Matrículas — últimos 30 dias"
            description="Novas entradas no período. Ideal para acompanhar campanhas e sazonalidade."
            id="admin-mat-30-heading"
            dataTour="admin-dashboard-matriculas-30"
            variant="elevated"
            action={
              <Link
                href="/enrollments"
                className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
              >
                Ver todas →
              </Link>
            }
          >
            <div className="flex flex-wrap items-end gap-4">
              <p className="text-5xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">
                {recentEnrollmentsCount}
              </p>
              <div className="flex items-center gap-2 rounded-full bg-[var(--igh-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--igh-primary)]">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                Janela móvel de 30 dias
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mt-8">
          <PlatformExperienceSummarySection
            summary={platformExperienceSummary}
            href="/admin/avaliacoes-experiencia"
            title="Avaliações dos alunos"
            description="Médias de 1 a 10 (plataforma, aulas, professor) em todas as respostas registradas."
          />
        </div>

        {openClassGroups.length > 0 && (
          <section className="mt-8" data-tour="admin-dashboard-turmas-abertas">
            <SectionCard
              title="Turmas no ar"
              description="Abertas ou em andamento — acesso rápido a matrículas e vagas."
              id="admin-turmas-abertas-heading"
              action={
                <Link
                  href="/class-groups"
                  className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
                >
                  Ver todas →
                </Link>
              }
            >
              <TableShell>
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/90 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Curso</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Professor</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Status</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Início</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Vagas</th>
                  </tr>
                </thead>
                <tbody>
                  {openClassGroups.map((cg) => (
                    <ClassGroupRow key={cg.id} cg={cg} />
                  ))}
                </tbody>
              </TableShell>
            </SectionCard>
          </section>
        )}

        <section className="mt-8" aria-labelledby="admin-gamificacao-heading">
          <SectionCard
            title="Gamificação — professores"
            description="Ranking por pontuação total: conteúdo, exercícios, frequência, fórum, horas assistidas e exercícios realizados pelos alunos."
            id="admin-gamificacao-heading"
            action={
              <Link
                href="/gamificacao"
                className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
              >
                Quadro completo →
              </Link>
            }
          >
            {teachersGamificationRanking.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhum professor ativo.</p>
            ) : (
              <TableShell>
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/90 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">#</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Professor</th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersGamificationRanking.slice(0, 8).map((r, i) => (
                    <tr key={r.teacherId} className="border-b border-[var(--card-border)] transition hover:bg-[var(--igh-surface)]/40">
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{r.teacherName}</td>
                      <td className="px-4 py-3 text-right text-lg font-bold tabular-nums text-[var(--igh-primary)]">
                        {r.points.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </SectionCard>
        </section>

        <section className="mt-10" data-tour="admin-dashboard-atalhos">
          <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">O que você precisa agora?</h2>
          <p className="mb-4 max-w-2xl text-sm text-[var(--text-muted)]">
            Atalhos para as tarefas mais comuns — comunicação, pessoas e operação acadêmica.
          </p>
          <QuickActionGrid
            items={[
              {
                href: "/enrollments",
                label: "Matrículas",
                description: "Confirmar, filtrar e acompanhar turmas",
                icon: UserPlus,
                accent: "from-emerald-500 to-teal-600",
              },
              {
                href: "/students",
                label: "Alunos",
                description: "Cadastros e perfis de estudantes",
                icon: GraduationCap,
                accent: "from-violet-500 to-purple-700",
              },
              {
                href: "/teachers",
                label: "Professores",
                description: "Corpo docente e vínculos",
                icon: Users2,
                accent: "from-sky-500 to-blue-700",
              },
              {
                href: "/courses",
                label: "Cursos",
                description: "Conteúdo e estrutura pedagógica",
                icon: BookOpen,
                accent: "from-amber-500 to-orange-600",
              },
              {
                href: "/class-groups",
                label: "Turmas",
                description: "Ofertas, calendário e vagas",
                icon: School,
                accent: "from-rose-500 to-red-600",
              },
              {
                href: "/admin/email",
                label: "E-mail em massa",
                description: "Campanhas e disparos para a base",
                icon: Mail,
                accent: "from-indigo-500 to-violet-700",
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
                href: "/admin/site/configuracoes",
                label: "Site & configurações",
                description: "Institucional, banners e ajustes",
                icon: LayoutDashboard,
                accent: "from-slate-500 to-slate-700",
              },
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
  const {
    myClassGroupsCount,
    myEnrollmentsCount,
    classGroups,
    roleLabel,
    gamification,
    platformExperienceSummary,
    forumLessonsWithActivity,
  } = data;
  const totalVagasDisponiveis = classGroups.reduce(
    (acc, cg) => acc + Math.max(0, (cg.capacity ?? 0) - (cg.enrollmentsCount ?? 0)),
    0
  );
  const firstName = userName?.split(/\s+/)[0] ?? "Professor";

  return (
    <div className="min-w-0">
        <DashboardHero
          dataTour="teacher-dashboard-welcome"
          eyebrow="Área do professor"
          title={`Bem-vindo, ${firstName}`}
          description={
            <>
              Turmas, alunos e engajamento em um painel pensado para o seu dia a dia em sala (virtual ou presencial).
              <span className="mt-2 block text-xs font-medium text-[var(--text-muted)]">
                Perfil: <span className="text-[var(--text-primary)]">{roleLabel}</span>
              </span>
            </>
          }
        />

        <section className="mt-2" data-tour="teacher-dashboard-resumo" aria-label="Seu resumo">
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

        <div className="mt-8">
          <PlatformExperienceSummarySection
            summary={platformExperienceSummary}
            href="/professor/avaliacoes-experiencia"
            title="Avaliações dos meus alunos"
            description="Apenas alunos com matrícula ativa em turmas suas. Inclui notas e comentários quando enviados."
          />
        </div>

        <div className="mt-8">
          <DashboardForumActivityRail variant="teacher" items={forumLessonsWithActivity} />
        </div>

        {gamification ? (
          <div className="mt-8">
            <TeacherGamificationPanel g={gamification} />
          </div>
        ) : null}

        {classGroups.length > 0 && (
          <section className="mt-8" data-tour="teacher-dashboard-turmas">
            <SectionCard
              title="Suas turmas no ar"
              description="Abertas ou em andamento — presenças, sessões e conteúdo a um clique."
              id="teacher-turmas-heading"
              action={
                <Link
                  href="/professor/turmas"
                  className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
                >
                  Ver todas →
                </Link>
              }
            >
              <TableShell>
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/90 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Curso</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Status</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Início</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Vagas</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {classGroups.map((cg) => (
                    <tr key={cg.id} className="transition hover:bg-[var(--igh-surface)]/40">
                      <td className="border-b border-[var(--card-border)] px-4 py-3">
                        <Link
                          href={`/enrollments?turma=${cg.id}`}
                          className="font-semibold text-[var(--text-primary)] hover:text-[var(--igh-primary)] hover:underline"
                        >
                          {cg.courseName}
                        </Link>
                      </td>
                      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">
                        {STATUS_LABELS[cg.status] ?? cg.status}
                      </td>
                      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">
                        {formatDate(cg.startDate)}
                      </td>
                      <td className="border-b border-[var(--card-border)] px-4 py-3 text-[var(--text-secondary)]">
                        {cg.enrollmentsCount} / {cg.capacity}
                      </td>
                      <td className="border-b border-[var(--card-border)] px-4 py-3">
                        <span className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/professor/turmas/${cg.id}`}
                            className="rounded-md bg-[var(--igh-primary)]/10 px-2 py-1 text-xs font-bold text-[var(--igh-primary)] hover:bg-[var(--igh-primary)]/20"
                          >
                            Turma
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
            </SectionCard>
          </section>
        )}

        <section className="mt-10" data-tour="teacher-dashboard-atalhos">
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
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
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
        {enrollment.exerciseTotalAttempts > 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            Exercícios: {enrollment.exerciseCorrectAttempts}/{enrollment.exerciseTotalAttempts} acertos
            {enrollment.exerciseTotalAttempts > 0 && (
              <span className="font-medium text-[var(--igh-primary)]">
                {" "}({Math.round((enrollment.exerciseCorrectAttempts / enrollment.exerciseTotalAttempts) * 100)}%)
              </span>
            )}
          </p>
        )}
        <p className="mt-auto text-sm text-[var(--text-muted)]">
          {isComplete ? "Curso concluído" : hasProgress ? "Continuar estudando" : "Acessar conteúdo e desempenho"}
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
    totalExerciseCorrect,
    totalExerciseAttempts,
    totalAttendancePresent,
    totalForumQuestions,
    totalForumReplies,
    forumLessonsWithActivity,
  } = data;
  const firstName = userName?.split(/\s+/)[0] ?? "Aluno";
  const pointsContent = totalLessonsCompleted * POINTS_PER_LESSON;
  // Exercícios realizados contam por tentativas; acertos contam um bônus extra.
  const pointsExercises = totalExerciseAttempts + totalExerciseCorrect;
  const pointsFrequency = totalAttendancePresent * GAMIFICATION_POINTS.attendancePerPresentStudent;
  const pointsForum = (totalForumQuestions + totalForumReplies) * GAMIFICATION_POINTS.forumPerReply;
  const points = pointsContent + pointsExercises + pointsFrequency + pointsForum;
  const levelInfo = getLevel(points);
  const badgesUnlocked = BADGES.filter((b) =>
    b.condition({
      total: totalLessonsTotal,
      completed: totalLessonsCompleted,
      enrollments,
    })
  );
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

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
        <DashboardHero
          dataTour="dashboard-welcome"
          eyebrow="Sua jornada de aprendizado"
          title={`Olá, ${firstName}!`}
          description="Progresso, exercícios, conquistas e acesso rápido ao que importa para você evoluir."
          rightSlot={
            <StudentPlatformExperienceModal
              autoPromptOnce={enrollments.length > 0}
              className="w-full sm:w-auto"
            />
          }
        />

      {enrollments.length > 0 ? (
        <>
          <div
            className={`grid gap-6 ${totalLessonsTotal > 0 ? "lg:grid-cols-5" : ""}`}
          >
          {totalLessonsTotal > 0 && (
            <SectionCard
              title="Seu progresso"
              description="Aulas concluídas em relação ao total — cada passo conta."
              id="resumo-progresso-heading"
              dataTour="dashboard-progresso-geral"
              variant="elevated"
              className="lg:col-span-3"
            >
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
            </SectionCard>
          )}

          <SectionCard
            title="Desempenho nos exercícios"
            description="Acertos e revisão por tópico — use para reforçar o que ainda precisa de atenção."
            id="exercicios-heading"
            dataTour="dashboard-desempenho-exercicios"
            variant={totalLessonsTotal > 0 ? "default" : "elevated"}
            className={totalLessonsTotal > 0 ? "lg:col-span-2" : ""}
          >
            {totalExerciseAttempts > 0 ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-4xl font-bold tabular-nums text-[var(--text-primary)]">{totalExerciseCorrect}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    acertos em {totalExerciseAttempts} {totalExerciseAttempts === 1 ? "tentativa" : "tentativas"}
                    <span className="ml-2 font-bold text-[var(--igh-primary)]">
                      {Math.round((totalExerciseCorrect / totalExerciseAttempts) * 100)}%
                    </span>
                  </p>
                </div>
                <Link
                  href="/minhas-turmas"
                  className="inline-flex items-center gap-1 text-sm font-bold text-[var(--igh-primary)] hover:underline"
                >
                  Ver por curso e tópicos
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Responda às questões ao final das aulas para ver aqui seu desempenho e quais tópicos merecem uma segunda leitura.
              </p>
            )}
          </SectionCard>
          </div>

          <DashboardForumActivityRail variant="student" items={forumLessonsWithActivity} />

          {continueLink && continueLabel && (
            <section aria-labelledby="continuar-heading">
              <h2 id="continuar-heading" className="sr-only">
                Continuar de onde parou
              </h2>
              <Link
                href={continueLink}
                className="group relative flex flex-wrap items-center gap-5 overflow-hidden rounded-2xl border-2 border-[var(--igh-primary)]/35 bg-gradient-to-br from-[var(--igh-primary)]/12 via-[var(--card-bg)] to-violet-500/10 p-5 shadow-lg shadow-[var(--igh-primary)]/10 transition hover:border-[var(--igh-primary)]/55 hover:shadow-xl focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:p-6"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--igh-primary)]/20 blur-3xl" aria-hidden />
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--igh-primary)] text-white shadow-lg shadow-[var(--igh-primary)]/30">
                  <PlayCircle className="h-7 w-7" aria-hidden />
                </div>
                <div className="relative min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--igh-primary)]">
                    Continuar de onde parou
                  </p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--igh-primary)]">
                    {continueLabel}
                  </p>
                  {continueSublabel && (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {continueSublabel}
                    </p>
                  )}
                </div>
                <ChevronRight className="relative h-6 w-6 shrink-0 text-[var(--igh-primary)] transition group-hover:translate-x-1" aria-hidden />
              </Link>
            </section>
          )}

          <section
            className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-[var(--card-bg)] to-violet-50/30 p-5 shadow-md dark:border-amber-900/40 dark:from-amber-950/40 dark:via-[var(--card-bg)] dark:to-violet-950/20 sm:p-7"
            aria-labelledby="gamificacao-heading"
            data-tour="dashboard-sua-evolucao"
          >
            <h2 id="gamificacao-heading" className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
              <Trophy className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              Sua evolução
            </h2>
            <div className="mt-5 flex flex-wrap gap-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <Flame className="h-7 w-7 text-amber-700 dark:text-amber-300" aria-hidden />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">{points}</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">pontos</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Conteúdo {pointsContent} · Exercícios {pointsExercises} · Frequência {pointsFrequency} · Fórum {pointsForum}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--igh-primary)]/15">
                  <Award className="h-7 w-7 text-[var(--igh-primary)]" aria-hidden />
                </div>
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{levelInfo.name}</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">nível atual</p>
                </div>
              </div>
            </div>
            {levelInfo.next && (
              <div className="mt-5">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  Próximo: {levelInfo.next.name} ({levelInfo.next.min} pts)
                </p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--igh-surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--igh-primary)] transition-all"
                    style={{ width: `${Math.round(levelInfo.progressInLevel * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div className="mt-6">
              <p className="text-base font-semibold text-[var(--text-primary)]">Conquistas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {BADGES.map((badge) => {
                  const unlocked = badgesUnlocked.some((b) => b.id === badge.id);
                  return (
                    <span
                      key={badge.id}
                      title={badge.label}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ${
                        unlocked
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                          : "bg-[var(--igh-surface)] text-[var(--text-muted)]"
                      }`}
                    >
                      {unlocked ? (
                        <Star className="h-4 w-4 shrink-0 fill-amber-600 dark:fill-amber-400" aria-hidden />
                      ) : (
                        <Star className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                      )}
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          <section aria-labelledby="cursos-heading" className="mt-2">
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
              ? "Falha na conexão com o banco de dados. Verifique se o servidor está rodando e se a variável DATABASE_URL no .env está correta."
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
      {data.role === "ADMIN" || data.role === "MASTER" ? (
        <DashboardAdmin data={data} userName={user.name} />
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
            data.role === "TEACHER")
        }
        steps={
          data.role === "STUDENT"
            ? STUDENT_TUTORIAL_STEPS
            : data.role === "ADMIN" || data.role === "MASTER"
              ? ADMIN_TUTORIAL_STEPS
              : data.role === "TEACHER"
                ? TEACHER_TUTORIAL_STEPS
                : []
        }
        storageKey={
          data.role === "ADMIN" || data.role === "MASTER"
            ? "admin-dashboard-tutorial-done"
            : data.role === "TEACHER"
              ? "teacher-dashboard-tutorial-done"
              : undefined
        }
      />
    </>
  );
}
