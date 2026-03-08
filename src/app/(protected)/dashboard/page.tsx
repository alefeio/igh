import Link from "next/link";
import { BookOpen, ChevronRight, GraduationCap, Sparkles, Star, UserCircle } from "lucide-react";

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
};

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
  const statusOrder = ["ABERTA", "EM_ANDAMENTO", "PLANEJADA", "ENCERRADA", "CANCELADA"] as const;

  return (
    <div className="container-page flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Visão geral do sistema. Seu perfil: <span className="font-medium">{roleLabel}</span>
        </p>
      </header>

      <section>
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
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
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
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
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
        <section>
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

      <section>
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

  return (
    <div className="container-page flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Seu perfil: <span className="font-medium">{roleLabel}</span>
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Seu resumo</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Turmas ativas" value={myClassGroupsCount} />
          <StatCard label="Alunos matriculados" value={myEnrollmentsCount} />
        </div>
      </section>

      {classGroups.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Suas turmas (abertas ou em andamento)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Curso</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Início</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Vagas</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Atalhos</h2>
        <QuickLinks links={[{ href: "/students", label: "Alunos" }]} />
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
      href={`/minhas-turmas/${enrollment.id}`}
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
        <p className="mt-auto text-sm text-[var(--text-muted)]">
          {isComplete ? "Curso concluído" : hasProgress ? "Continuar estudando" : "Acessar conteúdo"}
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
  const { enrollments, activeEnrollmentsCount } = data;
  const firstName = userName?.split(/\s+/)[0] ?? "Aluno";

  return (
    <div className="container-page flex flex-col gap-8">
      <header>
        <div className="flex items-center gap-2 text-[var(--igh-primary)]">
          <Sparkles className="h-6 w-6" aria-hidden />
          <span className="text-sm font-medium">Seu painel</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Olá, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Aqui você acompanha seus cursos e acessa rapidamente o que precisa.
        </p>
      </header>

      {enrollments.length > 0 ? (
        <>
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
    </>
  );
}
