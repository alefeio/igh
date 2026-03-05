import Link from "next/link";

import { requireSessionUser } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardData,
  type DashboardDataAdmin,
  type ClassGroupSummary,
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Visão geral do sistema. Seu perfil: <span className="font-medium">{roleLabel}</span>
        </p>
      </div>

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Seu perfil: <span className="font-medium">{roleLabel}</span>
        </p>
      </div>

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

function DashboardStudent({ data }: { data: Extract<DashboardData, { role: "STUDENT" }> }) {
  const { activeEnrollmentsCount, roleLabel } = data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Seu perfil: <span className="font-medium">{roleLabel}</span>
        </p>
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Bem-vindo ao sistema</h2>
        <p className="mt-2 text-[var(--text-secondary)]">
          Use o menu ao lado para acessar as funcionalidades do seu perfil.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Minhas turmas"
            value={activeEnrollmentsCount}
            href="/minhas-turmas"
            sublabel={activeEnrollmentsCount === 1 ? "1 matrícula ativa" : `${activeEnrollmentsCount} matrículas ativas`}
          />
          <StatCard label="Meus dados" value="—" href="/meus-dados" sublabel="Cadastro e anexos" />
        </div>
        <div className="mt-4">
          <QuickLinks
            links={[
              { href: "/minhas-turmas", label: "Minhas turmas" },
              { href: "/meus-dados", label: "Meus dados" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const data = await getDashboardData(user);

  return (
    <div className="flex flex-col gap-4">
      {data.role === "ADMIN" || data.role === "MASTER" ? (
        <DashboardAdmin data={data} />
      ) : data.role === "TEACHER" ? (
        <DashboardTeacher data={data} />
      ) : (
        <DashboardStudent data={data as Extract<DashboardData, { role: "STUDENT" }>} />
      )}
    </div>
  );
}
