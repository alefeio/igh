import "server-only";

import { unstable_cache } from "next/cache";

import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { pickCurrentCycle } from "@/lib/cycles";
import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";
import {
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
  countConsecutiveUnjustifiedAbsenceStreak,
} from "@/lib/enrollment-attendance-streak";
import { formatCycleLabel } from "@/lib/gamification-cycle";
import { prisma } from "@/lib/prisma";
import {
  getCachedStudentGamificationRankingFull,
} from "@/lib/cached-dashboard-queries";
import {
  computeAllTeachersGamification,
} from "@/lib/teacher-gamification";

export type DirectorScopeMode = "current" | "all" | "cycle";

export type DirectorCycleOption = {
  id: string;
  label: string;
  cycle: number;
  year: number;
  isCurrent: boolean;
};

export type DirectorKpis = {
  turmas: number;
  turmasEmAndamento: number;
  capacidade: number;
  inscritos: number;
  ocupacaoPercent: number | null;
  turmasGe80: number;
  turmas100: number;
  turmasSemInscritos: number;
  turmasAbaixo30: number;
  suspensos: number;
  cancelados: number;
  evasao: number;
  formados: number;
  frequenciaMediaPercent: number | null;
  /** Sessões já ocorridas (média por turma com inscritos). */
  sessoesPassadasMedia: number | null;
};

export type DirectorCourseRow = {
  courseId: string;
  courseName: string;
  turmas: number;
  capacidade: number;
  inscritos: number;
  ocupacaoPercent: number | null;
  suspensos: number;
  cancelados: number;
  evasao: number;
  formados: number;
  mediaIniciaram: number | null;
  mediaTerminaram: number | null;
  frequenciaMediaPercent: number | null;
};

export type DirectorTerritoryRow = {
  territorio: string;
  turmas: number;
  capacidade: number;
  inscritos: number;
  ocupacaoPercent: number | null;
};

export type DirectorStudentsBlock = {
  totalHistorico: number;
  unicosNoRecorte: number;
  formadosMatriculas: number;
  frequenciaMediaPercent: number | null;
  comMaisDeUmCurso: number;
  porCiclo: Array<{
    cycleId: string;
    label: string;
    unicos: number;
    inscritos: number;
    formados: number;
    frequenciaMediaPercent: number | null;
  }>;
};

export type DirectorEvolutionPoint = {
  /** YYYY-MM-DD (início da semana UTC). */
  date: string;
  label: string;
  inscritosAcumulados: number;
  ocupantesEstimados: number;
};

export type DirectorHighlightPerson = {
  id: string;
  name: string;
  metricLabel: string;
  metricValue: string;
  extra?: string;
};

export type DirectorHighlights = {
  teachersByLoad: DirectorHighlightPerson[];
  teachersByOccupation: DirectorHighlightPerson[];
  teachersByForum: DirectorHighlightPerson[];
  teachersByWatchHours: DirectorHighlightPerson[];
  studentsByPoints: DirectorHighlightPerson[];
  studentsByForum: DirectorHighlightPerson[];
  studentsByExercises: DirectorHighlightPerson[];
  studentsByWatchTime: DirectorHighlightPerson[];
  studentsByAttendance: DirectorHighlightPerson[];
};

export type DirectorGerenciaSummary = {
  colaboradoresTotal: number;
  colaboradoresAtivos: number;
  colaboradoresDocsPendentes: number;
  contratosAtivos: number;
  financeiroEntradasMesCents: number;
  financeiroSaidasMesCents: number;
  folhaCompetencia: string | null;
  folhaPendentes: number;
  folhaPagos: number;
  almoxarifadoItens: number;
  almoxarifadoBaixoEstoque: number;
  doacoesAno: number;
  doacoesKitsAno: number;
  donatariasAtivas: number;
  doadorasAtivas: number;
  beneficiadosTermos: number;
  beneficiadosKits: number;
};

export type DirectorInsight = {
  tone: "info" | "attention" | "positive";
  title: string;
  body: string;
  /** Orientação objetiva para decisão. */
  action?: string;
};

export type DirectorDashboardPayload = {
  role: "DIRECTOR";
  roleLabel: string;
  scope: DirectorScopeMode;
  cycleId: string | null;
  cycleLabel: string;
  cycles: DirectorCycleOption[];
  updatedAt: string;
  kpis: DirectorKpis;
  courses: DirectorCourseRow[];
  territories: DirectorTerritoryRow[];
  students: DirectorStudentsBlock;
  evolution: DirectorEvolutionPoint[];
  highlights: DirectorHighlights;
  gerencia: DirectorGerenciaSummary;
  insights: DirectorInsight[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return round1((num / den) * 100);
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekUtc(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
}

function addDaysUtc(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function formatWeekLabel(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${m}`;
}

type ClassGroupRow = {
  id: string;
  status: string;
  capacity: number;
  startDate: Date;
  endDate: Date | null;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  coTeacherNames: string[];
  territorio: string;
  cycleId: string;
  cycle: number;
  year: number;
};

type EnrollmentRow = {
  id: string;
  studentId: string;
  classGroupId: string;
  status: string;
  enrolledAt: Date;
  updatedAt: Date;
  certificateEligible: boolean;
  courseId: string;
};

async function loadClassGroups(cycleIds: string[] | null): Promise<ClassGroupRow[]> {
  const classGroups = await prisma.classGroup.findMany({
    where: {
      status: { not: "CANCELADA" },
      ...(cycleIds ? { cycleId: { in: cycleIds } } : {}),
    },
    select: {
      id: true,
      status: true,
      capacity: true,
      startDate: true,
      endDate: true,
      location: true,
      courseId: true,
      teacherId: true,
      cycleId: true,
      course: { select: { name: true } },
      teacher: { select: { name: true } },
      classGroupTeachers: { select: { teacher: { select: { name: true } } } },
      poloLocation: {
        select: {
          name: true,
          polo: { select: { name: true } },
        },
      },
      cycle: { select: { cycle: true, year: true } },
    },
  });

  return classGroups.map((cg) => {
    const territorio =
      cg.poloLocation != null
        ? cg.poloLocation.polo.name
        : (cg.location ?? "").trim() || "Sem território";
    const coTeacherNames = cg.classGroupTeachers
      .map((t) => t.teacher.name.trim())
      .filter((n) => n && n !== cg.teacher.name.trim());
    return {
      id: cg.id,
      status: cg.status,
      capacity: cg.capacity,
      startDate: cg.startDate,
      endDate: cg.endDate,
      courseId: cg.courseId,
      courseName: cg.course.name,
      teacherId: cg.teacherId,
      teacherName: cg.teacher.name,
      coTeacherNames,
      territorio,
      cycleId: cg.cycleId,
      cycle: cg.cycle.cycle,
      year: cg.cycle.year,
    };
  });
}

async function loadEnrollments(classGroupIds: string[]): Promise<EnrollmentRow[]> {
  if (classGroupIds.length === 0) return [];
  const rows = await prisma.enrollment.findMany({
    where: { classGroupId: { in: classGroupIds } },
    select: {
      id: true,
      studentId: true,
      classGroupId: true,
      status: true,
      enrolledAt: true,
      updatedAt: true,
      certificateEligible: true,
      classGroup: { select: { courseId: true } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    studentId: e.studentId,
    classGroupId: e.classGroupId,
    status: e.status,
    enrolledAt: e.enrolledAt,
    updatedAt: e.updatedAt,
    certificateEligible: e.certificateEligible,
    courseId: e.classGroup.courseId,
  }));
}

/** Evasão: ≥4 faltas consecutivas sem justificativa (cancelado ou ainda ativo/suspenso). */
async function findEvasionEnrollmentIds(
  enrollments: EnrollmentRow[],
  classGroupIds: string[],
): Promise<Set<string>> {
  const evasion = new Set<string>();
  if (enrollments.length === 0 || classGroupIds.length === 0) return evasion;

  const candidates = enrollments.filter((e) =>
    e.status === "ACTIVE" || e.status === "SUSPENDED" || e.status === "CANCELLED",
  );
  if (candidates.length === 0) return evasion;

  const sessions = await prisma.classSession.findMany({
    where: { classGroupId: { in: classGroupIds }, status: "LIBERADA" },
    orderBy: [{ sessionDate: "desc" }, { startTime: "desc" }],
    select: { id: true, classGroupId: true },
  });
  if (sessions.length === 0) return evasion;

  const sessionsByCg = new Map<string, { id: string }[]>();
  for (const s of sessions) {
    const list = sessionsByCg.get(s.classGroupId) ?? [];
    list.push({ id: s.id });
    sessionsByCg.set(s.classGroupId, list);
  }

  const enrollmentIds = candidates.map((e) => e.id);
  const sessionIds = sessions.map((s) => s.id);
  const attendances = await prisma.sessionAttendance.findMany({
    where: {
      enrollmentId: { in: enrollmentIds },
      classSessionId: { in: sessionIds },
    },
    select: {
      enrollmentId: true,
      classSessionId: true,
      present: true,
      absenceJustification: true,
    },
  });

  const attByEnrollment = new Map<
    string,
    Map<string, { present: boolean; absenceJustification: string | null }>
  >();
  for (const a of attendances) {
    let m = attByEnrollment.get(a.enrollmentId);
    if (!m) {
      m = new Map();
      attByEnrollment.set(a.enrollmentId, m);
    }
    m.set(a.classSessionId, {
      present: a.present,
      absenceJustification: a.absenceJustification,
    });
  }

  for (const e of candidates) {
    const sess = sessionsByCg.get(e.classGroupId) ?? [];
    if (sess.length < CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT) continue;
    const bySession = attByEnrollment.get(e.id) ?? new Map();
    const streak = countConsecutiveUnjustifiedAbsenceStreak(sess, bySession);
    if (streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT) {
      evasion.add(e.id);
    }
  }

  return evasion;
}

function buildEvolution(
  classGroups: ClassGroupRow[],
  enrollments: EnrollmentRow[],
): DirectorEvolutionPoint[] {
  if (classGroups.length === 0) return [];

  const starts = classGroups.map((c) => c.startDate.getTime());
  const ends = classGroups.map((c) => (c.endDate ?? c.startDate).getTime());
  const today = getEndOfTodayBrazil();
  let from = new Date(Math.min(...starts));
  let to = new Date(Math.min(Math.max(...ends), today.getTime()));
  if (to.getTime() < from.getTime()) to = from;

  from = startOfWeekUtc(from);
  to = startOfWeekUtc(to);

  const points: DirectorEvolutionPoint[] = [];
  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addDaysUtc(cursor, 7)) {
    const weekEnd = addDaysUtc(cursor, 6);
    weekEnd.setUTCHours(23, 59, 59, 999);
    const endMs = weekEnd.getTime();

    let inscritosAcumulados = 0;
    let ocupantesEstimados = 0;
    for (const e of enrollments) {
      if (e.enrolledAt.getTime() > endMs) continue;
      inscritosAcumulados += 1;
      if (e.status === "CANCELLED" && e.updatedAt.getTime() <= endMs) continue;
      ocupantesEstimados += 1;
    }

    points.push({
      date: toDateKey(cursor),
      label: formatWeekLabel(cursor),
      inscritosAcumulados,
      ocupantesEstimados,
    });
  }

  return points;
}

function buildInsights(params: {
  kpis: DirectorKpis;
  courses: DirectorCourseRow[];
  territories: DirectorTerritoryRow[];
  students: DirectorStudentsBlock;
  evasion: number;
  gerencia: DirectorGerenciaSummary;
}): DirectorInsight[] {
  const { kpis, courses, territories, students, evasion, gerencia } = params;
  const insights: DirectorInsight[] = [];

  if (evasion > 0) {
    insights.push({
      tone: "attention",
      title: "Risco crítico por faltas",
      body: `${evasion} matrícula(s) com streak ≥4 faltas consecutivas sem justificativa.`,
      action: "Priorize contato da coordenação/professores com esses alunos nesta semana.",
    });
  }

  if (kpis.turmasSemInscritos > 0 || kpis.turmasAbaixo30 > 0) {
    insights.push({
      tone: "attention",
      title: "Ocupação crítica",
      body: `${kpis.turmasSemInscritos} turma(s) sem inscritos e ${kpis.turmasAbaixo30} abaixo de 30%.`,
      action: "Concentre divulgação nessas ofertas antes de abrir turmas semelhantes.",
    });
  }

  if (kpis.suspensos > 0) {
    insights.push({
      tone: "attention",
      title: "Alunos suspensos",
      body: `${kpis.suspensos} matrícula(s) suspensa(s) (bloqueio por faltas).`,
      action: "Acompanhe retorno às aulas presenciais e suporte pedagógico.",
    });
  }

  if (gerencia.folhaPendentes > 0) {
    insights.push({
      tone: "attention",
      title: "Folha com pendências",
      body: `${gerencia.folhaPendentes} pagamento(s) pendente(s)${gerencia.folhaCompetencia ? ` na competência ${gerencia.folhaCompetencia}` : ""}.`,
      action: "Peça à Gerência o fechamento dos itens em aberto.",
    });
  }

  if (gerencia.colaboradoresDocsPendentes > 0) {
    insights.push({
      tone: "attention",
      title: "Documentação de colaboradores",
      body: `${gerencia.colaboradoresDocsPendentes} colaborador(es) com documentos pendentes.`,
      action: "Solicite regularização à Gerência para reduzir risco operacional.",
    });
  }

  if (gerencia.almoxarifadoBaixoEstoque > 0) {
    insights.push({
      tone: "attention",
      title: "Estoque baixo",
      body: `${gerencia.almoxarifadoBaixoEstoque} item(ns) do almoxarifado abaixo do mínimo.`,
      action: "Avalie reposição para não interromper atividades presenciais.",
    });
  }

  const saldoMes =
    gerencia.financeiroEntradasMesCents - gerencia.financeiroSaidasMesCents;
  if (saldoMes < 0) {
    insights.push({
      tone: "attention",
      title: "Caixa do mês negativo",
      body: `Saídas superam entradas em ${(Math.abs(saldoMes) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} neste mês.`,
      action: "Revise com a Gerência o fluxo de caixa e prioridades de despesa.",
    });
  }

  if (kpis.turmasGe80 > 0) {
    insights.push({
      tone: "positive",
      title: "Ofertas consolidadas",
      body: `${kpis.turmasGe80} turma(s) ≥ 80% de ocupação (${kpis.turmas100} lotadas).`,
      action: "Replique a mobilização dos polos/cursos com melhor adesão.",
    });
  }

  const topCourse = [...courses].sort((a, b) => b.inscritos - a.inscritos)[0];
  if (topCourse && topCourse.inscritos > 0) {
    const share = pct(topCourse.inscritos, kpis.inscritos);
    insights.push({
      tone: "info",
      title: "Principal motor de matrículas",
      body: `${topCourse.courseName}: ${topCourse.inscritos} inscritos (${share ?? 0}% do recorte), ocupação ${topCourse.ocupacaoPercent ?? 0}%.`,
      action: "Use este curso como referência de comunicação e oferta.",
    });
  }

  const weakTerritories = territories
    .filter((t) => (t.ocupacaoPercent ?? 0) < 40 && t.turmas > 0)
    .slice(0, 3);
  const strongTerritories = [...territories]
    .filter((t) => (t.ocupacaoPercent ?? 0) >= 80)
    .sort((a, b) => (b.ocupacaoPercent ?? 0) - (a.ocupacaoPercent ?? 0))
    .slice(0, 3);
  if (strongTerritories.length > 0) {
    insights.push({
      tone: "positive",
      title: "Territórios de referência",
      body: strongTerritories.map((t) => `${t.territorio} (${t.ocupacaoPercent}%)`).join(", ") + ".",
      action: "Espelhe práticas locais nesses polos.",
    });
  }
  if (weakTerritories.length > 0) {
    insights.push({
      tone: "attention",
      title: "Territórios em atenção",
      body: weakTerritories.map((t) => `${t.territorio} (${t.ocupacaoPercent ?? 0}%)`).join(", ") + ".",
      action: "Revisar horário, oferta e comunicação nestas localidades.",
    });
  }

  if (students.comMaisDeUmCurso > 0) {
    insights.push({
      tone: "positive",
      title: "Continuidade formativa",
      body: `${students.comMaisDeUmCurso} aluno(s) com mais de um curso.`,
      action: "Potencial para campanhas de reingresso e trajetórias longas.",
    });
  }

  if (kpis.frequenciaMediaPercent != null && kpis.frequenciaMediaPercent < 75) {
    insights.push({
      tone: "attention",
      title: "Frequência abaixo do desejável",
      body: `Frequência média de ${kpis.frequenciaMediaPercent}% (apenas aulas já ocorridas).`,
      action: "Peça plano de recuperação de presença por turma crítica.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: "info",
      title: "Recorte estável",
      body: `${kpis.turmas} turmas · ocupação ${kpis.ocupacaoPercent ?? 0}% · ${kpis.inscritos} inscritos.`,
      action: "Monitore ocupação e frequência semanalmente.",
    });
  }

  const order = { attention: 0, info: 1, positive: 2 } as const;
  return insights.sort((a, b) => order[a.tone] - order[b.tone]);
}

async function loadGerenciaSummary(): Promise<DirectorGerenciaSummary> {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    colaboradores,
    contratosAtivos,
    entradas,
    saidas,
    latestPayroll,
    almoxItens,
    doacoes,
    donatariasAtivas,
    doadorasAtivas,
    beneficiados,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null },
      select: {
        status: true,
        documents: { select: { type: true } },
      },
    }),
    prisma.employeeContract.count({
      where: { deletedAt: null, status: "ATIVO" },
    }),
    prisma.financialEntry.aggregate({
      where: {
        deletedAt: null,
        kind: "ENTRADA",
        entryDate: { gte: monthStart, lt: nextMonth },
      },
      _sum: { amountCents: true },
    }),
    prisma.financialEntry.aggregate({
      where: {
        deletedAt: null,
        kind: "SAIDA",
        entryDate: { gte: monthStart, lt: nextMonth },
      },
      _sum: { amountCents: true },
    }),
    prisma.payrollMonth.findFirst({
      orderBy: { referenceMonth: "desc" },
      select: {
        referenceMonth: true,
        lines: { select: { paymentStatus: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      where: { deletedAt: null, isActive: true },
      select: { quantityOnHand: true, minStock: true },
    }),
    prisma.donation.findMany({
      where: {
        deletedAt: null,
        status: "CONFIRMADA",
        donatedAt: { gte: yearStart },
      },
      select: { kitsCount: true },
    }),
    prisma.donataria.count({ where: { deletedAt: null, isActive: true } }),
    prisma.donorInstitutionSettings.count({
      where: { deletedAt: null, isActive: true },
    }),
    prisma.donation.findMany({
      where: { deletedAt: null, status: "CONFIRMADA", termNumber: { not: null } },
      select: { kitsCount: true },
    }),
  ]);

  const ativos = colaboradores.filter((e) => e.status === "ATIVO").length;
  const docsPendentesSimple = colaboradores.filter(
    (e) => e.status !== "DESLIGADO" && e.documents.length === 0,
  ).length;

  const folhaPendentes =
    latestPayroll?.lines.filter((l) => l.paymentStatus === "PENDENTE").length ?? 0;
  const folhaPagos =
    latestPayroll?.lines.filter((l) => l.paymentStatus === "PAGO").length ?? 0;
  const folhaCompetencia = latestPayroll
    ? `${String(latestPayroll.referenceMonth.getUTCMonth() + 1).padStart(2, "0")}/${latestPayroll.referenceMonth.getUTCFullYear()}`
    : null;

  const baixoEstoque = almoxItens.filter((i) => i.quantityOnHand <= i.minStock).length;

  return {
    colaboradoresTotal: colaboradores.length,
    colaboradoresAtivos: ativos,
    colaboradoresDocsPendentes: docsPendentesSimple,
    contratosAtivos,
    financeiroEntradasMesCents: entradas._sum.amountCents ?? 0,
    financeiroSaidasMesCents: saidas._sum.amountCents ?? 0,
    folhaCompetencia,
    folhaPendentes,
    folhaPagos,
    almoxarifadoItens: almoxItens.length,
    almoxarifadoBaixoEstoque: baixoEstoque,
    doacoesAno: doacoes.length,
    doacoesKitsAno: doacoes.reduce((s, d) => s + (d.kitsCount ?? 0), 0),
    donatariasAtivas,
    doadorasAtivas,
    beneficiadosTermos: beneficiados.length,
    beneficiadosKits: beneficiados.reduce((s, d) => s + (d.kitsCount ?? 0), 0),
  };
}

async function buildHighlights(
  cycleId: string | null,
  enrollments: EnrollmentRow[],
  classGroups: ClassGroupRow[],
): Promise<DirectorHighlights> {
  const teacherStats = new Map<
    string,
    { name: string; turmas: number; capacidade: number; inscritos: number }
  >();
  for (const cg of classGroups) {
    const cur = teacherStats.get(cg.teacherId) ?? {
      name: cg.teacherName,
      turmas: 0,
      capacidade: 0,
      inscritos: 0,
    };
    cur.turmas += 1;
    cur.capacidade += cg.capacity;
    const inscritos = enrollments.filter(
      (e) => e.classGroupId === cg.id && (e.status === "ACTIVE" || e.status === "SUSPENDED"),
    ).length;
    cur.inscritos += inscritos;
    teacherStats.set(cg.teacherId, cur);
  }

  const byLoad = [...teacherStats.entries()]
    .sort((a, b) => b[1].turmas - a[1].turmas)
    .slice(0, 5)
    .map(([id, t]) => ({
      id,
      name: t.name,
      metricLabel: "Turmas",
      metricValue: String(t.turmas),
      extra: `Ocupação ${pct(t.inscritos, t.capacidade) ?? 0}%`,
    }));

  const byOcc = [...teacherStats.entries()]
    .filter(([, t]) => t.capacidade > 0)
    .sort((a, b) => (pct(b[1].inscritos, b[1].capacidade) ?? 0) - (pct(a[1].inscritos, a[1].capacidade) ?? 0))
    .slice(0, 5)
    .map(([id, t]) => ({
      id,
      name: t.name,
      metricLabel: "Ocupação",
      metricValue: `${pct(t.inscritos, t.capacidade) ?? 0}%`,
      extra: `${t.inscritos}/${t.capacidade} · ${t.turmas} turma(s)`,
    }));

  let teachersByForum: DirectorHighlightPerson[] = [];
  let teachersByWatchHours: DirectorHighlightPerson[] = [];
  try {
    const gam = await computeAllTeachersGamification();
    teachersByForum = [...gam]
      .sort((a, b) => b.points.forum - a.points.forum)
      .slice(0, 5)
      .map((t) => ({
        id: t.teacherId,
        name: t.teacherName,
        metricLabel: "Fórum (pts)",
        metricValue: String(t.points.forum),
        extra: `Total ${t.points.total} pts`,
      }));
    teachersByWatchHours = [...gam]
      .sort((a, b) => b.points.studentWatchHours - a.points.studentWatchHours)
      .slice(0, 5)
      .map((t) => ({
        id: t.teacherId,
        name: t.teacherName,
        metricLabel: "Horas assistidas",
        metricValue: String(t.points.studentWatchHours),
        extra: `Total ${t.points.total} pts`,
      }));
  } catch {
    /* ranking opcional */
  }

  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const teachersByStudent = new Map<string, Set<string>>();
  for (const e of enrollments) {
    const cg = classGroups.find((c) => c.id === e.classGroupId);
    if (!cg) continue;
    let set = teachersByStudent.get(e.studentId);
    if (!set) {
      set = new Set();
      teachersByStudent.set(e.studentId, set);
    }
    set.add(cg.teacherName);
    for (const n of cg.coTeacherNames) set.add(n);
  }

  let studentsByPoints: DirectorHighlightPerson[] = [];
  let studentsByForum: DirectorHighlightPerson[] = [];
  let studentsByExercises: DirectorHighlightPerson[] = [];
  let studentsByAttendance: DirectorHighlightPerson[] = [];
  try {
    const ranking = await getCachedStudentGamificationRankingFull(cycleId ?? undefined);
    const scoped = cycleId
      ? ranking.filter((r) => studentIds.includes(r.studentId))
      : ranking;

    const withTeachers = (r: (typeof scoped)[0], metricLabel: string, metricValue: string) => ({
      id: r.studentId,
      name: r.displayName,
      metricLabel,
      metricValue,
      extra: `Prof.: ${[...(teachersByStudent.get(r.studentId) ?? [])].slice(0, 3).join(", ") || "—"}`,
    });

    studentsByPoints = scoped.slice(0, 5).map((r) =>
      withTeachers(r, "Pontos", String(r.points)),
    );
    studentsByForum = [...scoped]
      .sort((a, b) => b.breakdown.forumQuestions - a.breakdown.forumQuestions)
      .slice(0, 5)
      .map((r) => withTeachers(r, "Fóruns", String(r.breakdown.forumQuestions)));
    studentsByExercises = [...scoped]
      .sort((a, b) => b.breakdown.exerciseCorrect - a.breakdown.exerciseCorrect)
      .slice(0, 5)
      .map((r) =>
        withTeachers(
          r,
          "Acertos",
          `${r.breakdown.exerciseCorrect}/${r.breakdown.exerciseAttempts}`,
        ),
      );
    studentsByAttendance = [...scoped]
      .sort((a, b) => b.breakdown.attendancePresent - a.breakdown.attendancePresent)
      .slice(0, 5)
      .map((r) => withTeachers(r, "Presenças", String(r.breakdown.attendancePresent)));
  } catch {
    /* optional */
  }

  // Tempo de estudo (minutos) — agregação direta
  let studentsByWatchTime: DirectorHighlightPerson[] = [];
  if (enrollments.length > 0) {
    const enrollmentIds = enrollments.map((e) => e.id);
    const progress = await prisma.enrollmentLessonProgress.groupBy({
      by: ["enrollmentId"],
      where: { enrollmentId: { in: enrollmentIds } },
      _sum: { totalMinutesStudied: true },
    });
    const minutesByStudent = new Map<string, number>();
    const enrollmentToStudent = new Map(enrollments.map((e) => [e.id, e.studentId]));
    for (const p of progress) {
      const sid = enrollmentToStudent.get(p.enrollmentId);
      if (!sid) continue;
      minutesByStudent.set(
        sid,
        (minutesByStudent.get(sid) ?? 0) + (p._sum.totalMinutesStudied ?? 0),
      );
    }
    const studentNames = await prisma.student.findMany({
      where: { id: { in: [...minutesByStudent.keys()] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(studentNames.map((s) => [s.id, s.name]));
    studentsByWatchTime = [...minutesByStudent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, mins]) => ({
        id,
        name: nameById.get(id) ?? "Aluno",
        metricLabel: "Min. estudados",
        metricValue: String(mins),
        extra: `Prof.: ${[...(teachersByStudent.get(id) ?? [])].slice(0, 3).join(", ") || "—"}`,
      }));
  }

  return {
    teachersByLoad: byLoad,
    teachersByOccupation: byOcc,
    teachersByForum,
    teachersByWatchHours,
    studentsByPoints,
    studentsByForum,
    studentsByExercises,
    studentsByWatchTime,
    studentsByAttendance,
  };
}

export async function getDirectorDashboardData(opts: {
  scope: DirectorScopeMode;
  cycleId?: string | null;
}): Promise<DirectorDashboardPayload> {
  const cyclesDb = await prisma.cycle.findMany({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: { id: true, cycle: true, year: true },
  });
  const current = pickCurrentCycle(cyclesDb);
  const cycles: DirectorCycleOption[] = cyclesDb.map((c) => ({
    id: c.id,
    label: formatCycleLabel(c),
    cycle: c.cycle,
    year: c.year,
    isCurrent: current?.id === c.id,
  }));

  let scope = opts.scope;
  let cycleId: string | null = null;
  if (scope === "current") {
    cycleId = current?.id ?? null;
  } else if (scope === "cycle") {
    cycleId = opts.cycleId ?? current?.id ?? null;
    if (!cycleId || !cyclesDb.some((c) => c.id === cycleId)) {
      cycleId = current?.id ?? null;
      scope = "current";
    }
  } else {
    cycleId = null;
  }

  const cycleIds = scope === "all" ? null : cycleId ? [cycleId] : [];
  const classGroups = cycleIds && cycleIds.length === 0 ? [] : await loadClassGroups(cycleIds);
  const enrollments = await loadEnrollments(classGroups.map((c) => c.id));
  const evasionIds = await findEvasionEnrollmentIds(
    enrollments,
    classGroups.map((c) => c.id),
  );

  const byCg = new Map<string, EnrollmentRow[]>();
  for (const e of enrollments) {
    const list = byCg.get(e.classGroupId) ?? [];
    list.push(e);
    byCg.set(e.classGroupId, list);
  }

  const activeIds = enrollments
    .filter((e) => e.status === "ACTIVE" || e.status === "SUSPENDED")
    .map((e) => e.id);
  const attendanceMap = await getEnrollmentAttendanceSummaries(activeIds);

  let capacidade = 0;
  let inscritos = 0;
  let suspensos = 0;
  let cancelados = 0;
  let formados = 0;
  let turmasEmAndamento = 0;
  let turmasGe80 = 0;
  let turmas100 = 0;
  let turmasSemInscritos = 0;
  let turmasAbaixo30 = 0;
  const freqAll: number[] = [];
  const sessionsPerCg: number[] = [];

  for (const cg of classGroups) {
    capacidade += cg.capacity;
    if (cg.status === "EM_ANDAMENTO") turmasEmAndamento += 1;
    const rows = byCg.get(cg.id) ?? [];
    const insc = rows.filter((e) => e.status === "ACTIVE" || e.status === "SUSPENDED").length;
    const susp = rows.filter((e) => e.status === "SUSPENDED").length;
    const canc = rows.filter((e) => e.status === "CANCELLED").length;
    inscritos += insc;
    suspensos += susp;
    cancelados += canc;
    if (cg.status === "ENCERRADA") {
      formados += rows.filter(
        (e) =>
          e.status === "COMPLETED" ||
          ((e.status === "ACTIVE" || e.status === "SUSPENDED") && e.certificateEligible),
      ).length;
    } else {
      formados += rows.filter((e) => e.status === "COMPLETED").length;
    }

    const occ = pct(insc, cg.capacity);
    if (insc === 0) turmasSemInscritos += 1;
    else if ((occ ?? 0) < 30) turmasAbaixo30 += 1;
    if ((occ ?? 0) >= 80) turmasGe80 += 1;
    if ((occ ?? 0) >= 100) turmas100 += 1;

    let sessMax = 0;
    for (const e of rows) {
      if (e.status !== "ACTIVE" && e.status !== "SUSPENDED") continue;
      const s = attendanceMap.get(e.id);
      if (s?.percent != null) freqAll.push(s.percent);
      if (s) sessMax = Math.max(sessMax, s.totalSessions);
    }
    if (sessMax > 0) sessionsPerCg.push(sessMax);
  }

  const kpis: DirectorKpis = {
    turmas: classGroups.length,
    turmasEmAndamento,
    capacidade,
    inscritos,
    ocupacaoPercent: pct(inscritos, capacidade),
    turmasGe80,
    turmas100,
    turmasSemInscritos,
    turmasAbaixo30,
    suspensos,
    cancelados,
    evasao: evasionIds.size,
    formados,
    frequenciaMediaPercent: avg(freqAll),
    sessoesPassadasMedia: avg(sessionsPerCg),
  };

  // Cursos
  const courseMap = new Map<
    string,
    {
      courseName: string;
      turmas: number;
      capacidade: number;
      inscritos: number;
      suspensos: number;
      cancelados: number;
      evasao: number;
      formados: number;
      iniciaram: number[];
      terminaram: number[];
      freqs: number[];
    }
  >();
  for (const cg of classGroups) {
    const cur = courseMap.get(cg.courseId) ?? {
      courseName: cg.courseName,
      turmas: 0,
      capacidade: 0,
      inscritos: 0,
      suspensos: 0,
      cancelados: 0,
      evasao: 0,
      formados: 0,
      iniciaram: [] as number[],
      terminaram: [] as number[],
      freqs: [] as number[],
    };
    const rows = byCg.get(cg.id) ?? [];
    const insc = rows.filter((e) => e.status === "ACTIVE" || e.status === "SUSPENDED").length;
    const susp = rows.filter((e) => e.status === "SUSPENDED").length;
    const canc = rows.filter((e) => e.status === "CANCELLED").length;
    const form = rows.filter((e) => e.status === "COMPLETED").length;
    const ev = rows.filter((e) => evasionIds.has(e.id)).length;
    cur.turmas += 1;
    cur.capacidade += cg.capacity;
    cur.inscritos += insc;
    cur.suspensos += susp;
    cur.cancelados += canc;
    cur.evasao += ev;
    cur.formados += form;
    cur.iniciaram.push(insc);
    if (cg.status === "ENCERRADA") cur.terminaram.push(form);
    for (const e of rows) {
      if (e.status !== "ACTIVE" && e.status !== "SUSPENDED") continue;
      const s = attendanceMap.get(e.id);
      if (s?.percent != null) cur.freqs.push(s.percent);
    }
    courseMap.set(cg.courseId, cur);
  }
  const courses: DirectorCourseRow[] = [...courseMap.entries()]
    .map(([courseId, c]) => ({
      courseId,
      courseName: c.courseName,
      turmas: c.turmas,
      capacidade: c.capacidade,
      inscritos: c.inscritos,
      ocupacaoPercent: pct(c.inscritos, c.capacidade),
      suspensos: c.suspensos,
      cancelados: c.cancelados,
      evasao: c.evasao,
      formados: c.formados,
      mediaIniciaram: avg(c.iniciaram),
      mediaTerminaram: c.terminaram.length > 0 ? avg(c.terminaram) : null,
      frequenciaMediaPercent: avg(c.freqs),
    }))
    .sort((a, b) => b.inscritos - a.inscritos);

  // Territórios
  const terrMap = new Map<string, { turmas: number; capacidade: number; inscritos: number }>();
  for (const cg of classGroups) {
    const cur = terrMap.get(cg.territorio) ?? { turmas: 0, capacidade: 0, inscritos: 0 };
    const insc = (byCg.get(cg.id) ?? []).filter(
      (e) => e.status === "ACTIVE" || e.status === "SUSPENDED",
    ).length;
    cur.turmas += 1;
    cur.capacidade += cg.capacity;
    cur.inscritos += insc;
    terrMap.set(cg.territorio, cur);
  }
  const territories: DirectorTerritoryRow[] = [...terrMap.entries()]
    .map(([territorio, t]) => ({
      territorio,
      turmas: t.turmas,
      capacidade: t.capacidade,
      inscritos: t.inscritos,
      ocupacaoPercent: pct(t.inscritos, t.capacidade),
    }))
    .sort((a, b) => (b.ocupacaoPercent ?? 0) - (a.ocupacaoPercent ?? 0));

  // Alunos
  const totalHistorico = await prisma.student.count({ where: { deletedAt: null } });
  const unicosNoRecorte = new Set(enrollments.map((e) => e.studentId)).size;
  const coursesByStudent = new Map<string, Set<string>>();
  for (const e of enrollments) {
    if (!["ACTIVE", "SUSPENDED", "COMPLETED"].includes(e.status)) continue;
    let set = coursesByStudent.get(e.studentId);
    if (!set) {
      set = new Set();
      coursesByStudent.set(e.studentId, set);
    }
    set.add(e.courseId);
  }
  const comMaisDeUmCurso = [...coursesByStudent.values()].filter((s) => s.size > 1).length;

  const porCiclo: DirectorStudentsBlock["porCiclo"] = [];
  if (scope === "all") {
    for (const c of cyclesDb) {
      const cgs = classGroups.filter((g) => g.cycleId === c.id);
      const ids = new Set(cgs.map((g) => g.id));
      const ens = enrollments.filter((e) => ids.has(e.classGroupId));
      const unicos = new Set(ens.map((e) => e.studentId)).size;
      const insc = ens.filter((e) => e.status === "ACTIVE" || e.status === "SUSPENDED").length;
      const form = ens.filter((e) => e.status === "COMPLETED").length;
      const freqs: number[] = [];
      for (const e of ens) {
        if (e.status !== "ACTIVE" && e.status !== "SUSPENDED") continue;
        const s = attendanceMap.get(e.id);
        if (s?.percent != null) freqs.push(s.percent);
      }
      porCiclo.push({
        cycleId: c.id,
        label: formatCycleLabel(c),
        unicos,
        inscritos: insc,
        formados: form,
        frequenciaMediaPercent: avg(freqs),
      });
    }
  }

  const students: DirectorStudentsBlock = {
    totalHistorico,
    unicosNoRecorte,
    formadosMatriculas: formados,
    frequenciaMediaPercent: kpis.frequenciaMediaPercent,
    comMaisDeUmCurso,
    porCiclo,
  };

  const evolution = buildEvolution(classGroups, enrollments);
  const highlights = await buildHighlights(cycleId, enrollments, classGroups);
  const gerencia = await loadGerenciaSummary();
  const insights = buildInsights({
    kpis,
    courses,
    territories,
    students,
    evasion: evasionIds.size,
    gerencia,
  });

  const cycleLabel =
    scope === "all"
      ? "Relatório geral (todos os ciclos)"
      : cycleId
        ? (cycles.find((c) => c.id === cycleId)?.label ?? "Ciclo")
        : "Sem ciclo";

  return {
    role: "DIRECTOR",
    roleLabel: "Diretor",
    scope,
    cycleId,
    cycleLabel,
    cycles,
    updatedAt: new Date().toISOString(),
    kpis,
    courses,
    territories,
    students,
    evolution,
    highlights,
    gerencia,
    insights,
  };
}

export async function getCachedDirectorDashboard(opts: {
  scope: DirectorScopeMode;
  cycleId?: string | null;
}): Promise<DirectorDashboardPayload> {
  const key = `${opts.scope}:${opts.cycleId ?? "none"}`;
  return unstable_cache(
    () => getDirectorDashboardData(opts),
    ["director-dashboard-v2", key],
    { revalidate: 90 },
  )();
}
