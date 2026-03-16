import Link from "next/link";
import {
  Award,
  BookOpen,
  ChevronRight,
  Flame,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Star,
  Trophy,
  UserCircle,
} from "lucide-react";

import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { requireSessionUser } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardData,
  type DashboardDataAdmin,
  type ClassGroupSummary,
  type StudentEnrollmentSummary,
} from "@/lib/dashboard-data";

const STATUS_LABELS: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
  INTERNO: "Interno",
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
    content: "Você ganha pontos ao concluir aulas e acertar exercícios. Suba de nível (Iniciante, Explorador, Dedicado...) e desbloqueie conquistas ao longo da jornada.",
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
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({
  label,
  value,
  href,
  sublabel,
}: {
  label: string;
  value: number | string;
  href?: string;
  sublabel?: string;
}) {
  const content = (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-[var(--igh-primary)]/50">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
      {sublabel ? <div className="mt-0.5 text-xs text-[var(--text-muted)]">{sublabel}</div> : null}
    </div>
  );
  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function ClassGroupRow({ cg }: { cg: ClassGroupSummary }) {
  const vacancy = cg.capacity - cg.enrollmentsCount;
  return (
    <tr>
      <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-primary)]">
        <Link href={`/enrollments?turma=${cg.id}`} className="font-medium hover:underline">
          {cg.courseName}
        </Link>
      </td>
      <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-secondary)]">{cg.teacherName}</td>
      <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-secondary)]">
        {STATUS_LABELS[cg.status] ?? cg.status}
      </td>
      <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-secondary)]">
        {formatDate(cg.startDate)}
      </td>
      <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-secondary)]">
        {cg.enrollmentsCount} / {cg.capacity}
        {vacancy > 0 && <span className="ml-1 text-[var(--text-muted)]">({vacancy} vagas)</span>}
      </td>
    </tr>
  );
}

function QuickLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/50 hover:bg-[var(--igh-primary)]/10"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function DashboardAdmin({ data }: { data: DashboardDataAdmin }) {
  const { stats, recentEnrollmentsCount, openClassGroups, roleLabel } = data;
  const statusOrder = ["ABERTA", "EM_ANDAMENTO", "PLANEJADA", "ENCERRADA", "CANCELADA", "INTERNO"] as const;

  return (
    <div className="container-page flex flex-col gap-6">
      <header data-tour="admin-dashboard-welcome">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Visão geral do sistema. Seu perfil: <span className="font-medium">{roleLabel}</span>
        </p>
      </header>

      <section data-tour="admin-dashboard-resumo">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Resumo geral</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Alunos" value={stats.students} href="/students" />
          <StatCard label="Professores" value={stats.teachers} href="/teachers" />
          <StatCard label="Cursos" value={stats.courses} href="/courses" />
          <StatCard label="Turmas" value={stats.classGroups} href="/class-groups" />
          <StatCard
            label="Matrículas"
            value={stats.enrollments}
            href="/enrollments"
            sublabel={
              stats.preEnrollments > 0
                ? `${stats.preEnrollments} pré-matrículas · ${stats.confirmedEnrollments} confirmadas`
                : `${stats.confirmedEnrollments} confirmadas`
            }
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4" data-tour="admin-dashboard-turmas-status">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Turmas por status
          </h2>
          <ul className="mt-3 space-y-1.5">
            {statusOrder.map((status) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">{STATUS_LABELS[status]}</span>
                <span className="font-medium text-[var(--text-primary)]">{stats.classGroupsByStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4" data-tour="admin-dashboard-matriculas-30">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Matrículas (últimos 30 dias)
          </h2>
          <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{recentEnrollmentsCount}</p>
          <Link href="/enrollments" className="mt-2 inline-block text-sm text-[var(--igh-primary)] hover:underline">
            Ver todas as matrículas →
          </Link>
        </div>
      </section>

      {openClassGroups.length > 0 && (
        <section data-tour="admin-dashboard-turmas-abertas">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Turmas abertas ou em andamento
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Curso</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Professor</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Início</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Vagas</th>
                </tr>
              </thead>
              <tbody>
                {openClassGroups.map((cg) => (
                  <ClassGroupRow key={cg.id} cg={cg} />
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/class-groups" className="mt-2 inline-block text-sm text-[var(--igh-primary)] hover:underline">
            Ver todas as turmas →
          </Link>
        </section>
      )}

      <section data-tour="admin-dashboard-atalhos">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Atalhos</h2>
        <QuickLinks
          links={[
            { href: "/enrollments", label: "Matrículas" },
            { href: "/students", label: "Alunos" },
            { href: "/teachers", label: "Professores" },
            { href: "/courses", label: "Cursos" },
            { href: "/class-groups", label: "Turmas" },
          ]}
        />
      </section>
    </div>
  );
}

function DashboardTeacher({ data }: { data: Extract<DashboardData, { role: "TEACHER" }> }) {
  const { myClassGroupsCount, myEnrollmentsCount, classGroups, roleLabel } = data;
  const totalVagasDisponiveis = classGroups.reduce(
    (acc, cg) => acc + Math.max(0, (cg.capacity ?? 0) - (cg.enrollmentsCount ?? 0)),
    0
  );

  return (
    <div className="container-page flex flex-col gap-6">
      <header data-tour="teacher-dashboard-welcome">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Seu perfil: <span className="font-medium">{roleLabel}</span>. Aqui você acompanha suas turmas, alunos matriculados e atalhos.
        </p>
      </header>

      <section data-tour="teacher-dashboard-resumo">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Seu resumo</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Turmas ativas" value={myClassGroupsCount} href="/professor/turmas" />
          <StatCard label="Alunos matriculados" value={myEnrollmentsCount} href="/enrollments" />
          <StatCard label="Vagas disponíveis" value={totalVagasDisponiveis} />
        </div>
      </section>

      {classGroups.length > 0 && (
        <section data-tour="teacher-dashboard-turmas">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Suas turmas (abertas ou em andamento)
            </h2>
            <Link
              href="/professor/turmas"
              className="text-sm font-medium text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
            >
              Ver todas as turmas →
            </Link>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Curso</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Início</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Vagas</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {classGroups.map((cg) => (
                  <tr key={cg.id}>
                    <td className="border-b border-[var(--card-border)] px-3 py-2">
                      <Link
                        href={`/enrollments?turma=${cg.id}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {cg.courseName}
                      </Link>
                    </td>
                    <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-secondary)]">
                      {STATUS_LABELS[cg.status] ?? cg.status}
                    </td>
                    <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-secondary)]">
                      {formatDate(cg.startDate)}
                    </td>
                    <td className="border-b border-[var(--card-border)] px-3 py-2 text-[var(--text-secondary)]">
                      {cg.enrollmentsCount} / {cg.capacity}
                    </td>
                    <td className="border-b border-[var(--card-border)] px-3 py-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/professor/turmas/${cg.id}`}
                          className="text-[var(--igh-primary)] hover:underline text-xs font-medium"
                        >
                          Ver turma
                        </Link>
                        <span className="text-[var(--text-muted)]">·</span>
                        <Link
                          href={`/enrollments?turma=${cg.id}`}
                          className="text-[var(--igh-primary)] hover:underline text-xs font-medium"
                        >
                          Matrículas
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section data-tour="teacher-dashboard-atalhos">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Atalhos</h2>
        <QuickLinks
          links={[
            { href: "/professor/turmas", label: "Turmas que leciono" },
            { href: "/enrollments", label: "Matrículas" },
            { href: "/students", label: "Alunos" },
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
      className="group flex flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--igh-primary)]/15 text-[var(--igh-primary)]">
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
  } = data;
  const firstName = userName?.split(/\s+/)[0] ?? "Aluno";
  const points = totalLessonsCompleted * POINTS_PER_LESSON;
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
    <div className="container-page flex flex-col gap-8">
      <header data-tour="dashboard-welcome">
        <div className="flex items-center gap-2 text-[var(--igh-primary)]">
          <Sparkles className="h-6 w-6" aria-hidden />
          <span className="text-sm font-medium">Seu painel</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Olá, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Aqui você acompanha seus cursos, seu progresso e suas conquistas.
        </p>
      </header>

      {enrollments.length > 0 ? (
        <>
          {totalLessonsTotal > 0 && (
            <section
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5"
              aria-labelledby="resumo-progresso-heading"
              data-tour="dashboard-progresso-geral"
            >
              <h2 id="resumo-progresso-heading" className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Seu progresso geral
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--text-primary)]">
                    {totalLessonsCompleted}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    de {totalLessonsTotal} aulas concluídas
                  </span>
                </div>
                {globalPercent > 0 && (
                  <div className="min-w-[120px] flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--igh-surface)]">
                      <div
                        className="h-full rounded-full bg-[var(--igh-primary)] transition-all"
                        style={{ width: `${globalPercent}%` }}
                      />
                    </div>
                    <span className="mt-1 text-xs text-[var(--text-muted)]">{globalPercent}% do total</span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section
            className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5"
            aria-labelledby="exercicios-heading"
            data-tour="dashboard-desempenho-exercicios"
          >
            <h2 id="exercicios-heading" className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Desempenho nos exercícios
            </h2>
            {totalExerciseAttempts > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[var(--text-primary)]">
                      {totalExerciseCorrect}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">
                      acertos em {totalExerciseAttempts} {totalExerciseAttempts === 1 ? "tentativa" : "tentativas"}
                      {totalExerciseAttempts > 0 && (
                        <span className="ml-1 font-medium text-[var(--igh-primary)]">
                          ({Math.round((totalExerciseCorrect / totalExerciseAttempts) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <Link
                    href="/minhas-turmas"
                    className="text-sm font-medium text-[var(--igh-primary)] underline hover:no-underline"
                  >
                    Ver detalhes por curso (tópicos em que está bem e que precisam de atenção)
                  </Link>
                </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Você ainda não respondeu exercícios. Responda às questões ao final das aulas para ver aqui seu desempenho e quais tópicos precisam de revisão.
              </p>
            )}
          </section>

          {continueLink && continueLabel && (
            <section aria-labelledby="continuar-heading">
              <h2 id="continuar-heading" className="sr-only">
                Continuar de onde parou
              </h2>
              <Link
                href={continueLink}
                className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5 p-4 transition hover:border-[var(--igh-primary)]/50 hover:bg-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--igh-primary)] text-white">
                  <PlayCircle className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--igh-primary)]">
                    Continuar de onde parou
                  </p>
                  <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                    {continueLabel}
                  </p>
                  {continueSublabel && (
                    <p className="text-sm text-[var(--text-muted)]">
                      {continueSublabel}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
              </Link>
            </section>
          )}

          <section
            className="rounded-xl border border-[var(--card-border)] border-l-4 border-l-amber-500 bg-[var(--card-bg)] p-5 sm:p-6"
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

          <section aria-labelledby="cursos-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="cursos-heading" className="text-base font-semibold text-[var(--text-primary)]">
                Seus cursos
              </h2>
              <span className="text-sm text-[var(--text-muted)]">
                {activeEnrollmentsCount === 1
                  ? "1 matrícula ativa"
                  : `${activeEnrollmentsCount} matrículas ativas`}
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((e) => (
                <CourseCard key={e.id} enrollment={e} />
              ))}
            </div>
            <div className="mt-4">
              <Link
                href="/minhas-turmas"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
              >
                Ver todas as turmas
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-12 text-center"
          aria-label="Nenhum curso"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--igh-primary)]/10 text-[var(--igh-primary)]">
            <GraduationCap className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
            Você ainda não está em nenhuma turma
          </h2>
          <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
            Quando você for matriculado em um curso, ele aparecerá aqui com seu progresso.
          </p>
          <Link
            href="/minhas-turmas"
            className="mt-4 rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            Ver minhas turmas
          </Link>
        </section>
      )}

      <section aria-labelledby="atalhos-heading">
        <h2 id="atalhos-heading" className="text-base font-semibold text-[var(--text-primary)]">
          Acesso rápido
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/minhas-turmas"
            data-tour="dashboard-acesso-minhas-turmas"
            className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--igh-primary)]/15">
              <BookOpen className="h-5 w-5 text-[var(--igh-primary)]" aria-hidden />
            </div>
            <div>
              <span className="font-medium text-[var(--text-primary)]">Minhas turmas</span>
              <p className="text-xs text-[var(--text-muted)]">Ver todas e acessar conteúdo</p>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-[var(--text-muted)]" aria-hidden />
          </Link>
          <Link
            href="/minhas-turmas/favoritos"
            data-tour="dashboard-acesso-favoritos"
            className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            </div>
            <div>
              <span className="font-medium text-[var(--text-primary)]">Favoritos</span>
              <p className="text-xs text-[var(--text-muted)]">Aulas salvas na sua lista</p>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-[var(--text-muted)]" aria-hidden />
          </Link>
          <Link
            href="/meus-dados"
            data-tour="dashboard-acesso-meus-dados"
            className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <UserCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div>
              <span className="font-medium text-[var(--text-primary)]">Meus dados</span>
              <p className="text-xs text-[var(--text-muted)]">Cadastro e anexos</p>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-[var(--text-muted)]" aria-hidden />
          </Link>
        </div>
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
      <div className="container-page">
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
        <DashboardAdmin data={data} />
      ) : data.role === "TEACHER" ? (
        <DashboardTeacher data={data} />
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
