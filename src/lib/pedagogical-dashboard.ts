import "server-only";

import type { ClassGroupStatus, Prisma } from "@/generated/prisma/client";

import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";
import { syncCertificateEligibleFromAttendance } from "@/lib/enrollment-certificate-eligibility-sync";
import { enrollmentOccupiesSeat } from "@/lib/enrollment-seat";
import { prisma } from "@/lib/prisma";

const CLASS_GROUP_STATUSES = [
  "PLANEJADA",
  "ABERTA",
  "EM_ANDAMENTO",
  "ENCERRADA",
  "CANCELADA",
] as const satisfies readonly ClassGroupStatus[];

function parseClassGroupStatus(value: string | null | undefined): ClassGroupStatus | null {
  if (!value) return null;
  return (CLASS_GROUP_STATUSES as readonly string[]).includes(value)
    ? (value as ClassGroupStatus)
    : null;
}

export type PedagogicalDashboardFilters = {
  /** Um ou mais ciclos. Vazio = nenhum (sem inventar totais globais misturados). */
  cycleIds: string[];
  classGroupId?: string | null;
  teacherId?: string | null;
  courseId?: string | null;
  /** Ano do ciclo (ex.: 2026). */
  year?: number | null;
  /** Número do ciclo no ano (1, 2, 3…). */
  cycleNumber?: number | null;
  /** Status da turma. */
  classGroupStatus?: string | null;
  /** true = só externas; false = só internas; null = ambas. */
  isExternal?: boolean | null;
};

export type PedagogicalMetric = {
  key: string;
  label: string;
  value: number | string | null;
  /** Explicação quando value é null ou zero sem base. */
  hint?: string | null;
  /** Unidade auxiliar (ex.: "%"). */
  suffix?: string | null;
};

export type PedagogicalClassGroupRow = {
  id: string;
  courseName: string;
  teachers: string;
  status: string;
  statusLabel: string;
  cycleLabel: string;
  location: string;
  capacity: number;
  inscritos: number;
  ocupacaoPercent: number | null;
  formados: number;
  taxaFormadosPercent: number | null;
  frequenciaMediaPercent: number | null;
  sessoesComChamada: number;
  sessoesPassadas: number;
  isExternal: boolean;
};

export type PedagogicalDashboardPayload = {
  filtersApplied: PedagogicalDashboardFilters;
  cycles: Array<{
    id: string;
    cycle: number;
    year: number;
    label: string;
    isVisibleForEnrollments: boolean;
  }>;
  years: number[];
  cycleNumbers: number[];
  teachers: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
  classGroups: Array<{ id: string; label: string; cycleId: string }>;
  summary: PedagogicalMetric[];
  byStatus: Array<{ status: string; label: string; count: number }>;
  turmaRows: PedagogicalClassGroupRow[];
  notes: string[];
};

const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
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

function metric(
  key: string,
  label: string,
  value: number | string | null,
  opts?: { hint?: string | null; suffix?: string | null },
): PedagogicalMetric {
  return { key, label, value, hint: opts?.hint ?? null, suffix: opts?.suffix ?? null };
}

/** Opções de filtro (ciclos, professores, cursos, anos). */
export async function getPedagogicalDashboardFilterOptions() {
  const [cycles, teachers, courses] = await Promise.all([
    prisma.cycle.findMany({
      orderBy: [{ year: "desc" }, { cycle: "desc" }],
      select: { id: true, cycle: true, year: true, isVisibleForEnrollments: true },
    }),
    prisma.teacher.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.course.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const years = [...new Set(cycles.map((c) => c.year))].sort((a, b) => b - a);
  const cycleNumbers = [...new Set(cycles.map((c) => c.cycle))].sort((a, b) => a - b);

  return {
    cycles: cycles.map((c) => ({
      id: c.id,
      cycle: c.cycle,
      year: c.year,
      label: `Ciclo ${c.cycle} / ${c.year}`,
      isVisibleForEnrollments: c.isVisibleForEnrollments,
    })),
    years,
    cycleNumbers,
    teachers,
    courses,
  };
}

/**
 * Resumo pedagógico filtrável. Não inventa indicadores: quando não há base
 * (sem turmas, sem frequência lançada, etc.), devolve null + hint explícito.
 */
export async function getPedagogicalDashboard(
  filters: PedagogicalDashboardFilters,
): Promise<PedagogicalDashboardPayload> {
  const options = await getPedagogicalDashboardFilterOptions();
  const notes: string[] = [];

  // Resolve ciclo(s): year/cycleNumber refinam a lista de cycleIds.
  let cycleIds = [...filters.cycleIds];
  if (filters.year != null || filters.cycleNumber != null) {
    const matching = options.cycles.filter((c) => {
      if (filters.year != null && c.year !== filters.year) return false;
      if (filters.cycleNumber != null && c.cycle !== filters.cycleNumber) return false;
      return true;
    });
    if (cycleIds.length === 0) {
      cycleIds = matching.map((c) => c.id);
    } else {
      const allowed = new Set(matching.map((c) => c.id));
      cycleIds = cycleIds.filter((id) => allowed.has(id));
    }
  }

  if (cycleIds.length === 0 && (filters.year != null || filters.cycleNumber != null)) {
    notes.push("Nenhum ciclo corresponde ao ano/número selecionado.");
  }

  const statusFilter = parseClassGroupStatus(filters.classGroupStatus);
  const classGroupWhere: Prisma.ClassGroupWhereInput = {
    cycleId: { in: cycleIds },
  };
  // Sem status explícito, exclui canceladas; com filtro, usa exatamente o status pedido.
  // Atribuição separada evita união string | { not } que o Prisma tipa de forma estrita.
  if (statusFilter) {
    classGroupWhere.status = statusFilter;
  } else {
    classGroupWhere.status = { not: "CANCELADA" };
  }
  if (filters.classGroupId) classGroupWhere.id = filters.classGroupId;
  if (filters.courseId) classGroupWhere.courseId = filters.courseId;
  if (filters.isExternal === true) classGroupWhere.isExternal = true;
  else if (filters.isExternal === false) classGroupWhere.isExternal = false;
  if (filters.teacherId) {
    classGroupWhere.OR = [
      { teacherId: filters.teacherId },
      { classGroupTeachers: { some: { teacherId: filters.teacherId } } },
    ];
  }

  const classGroupsRaw =
    cycleIds.length === 0
      ? []
      : await prisma.classGroup.findMany({
          where: classGroupWhere,
          select: {
            id: true,
            status: true,
            capacity: true,
            isExternal: true,
            location: true,
            startDate: true,
            startTime: true,
            endTime: true,
            daysOfWeek: true,
            cycleId: true,
            cycle: { select: { cycle: true, year: true } },
            course: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true } },
            classGroupTeachers: {
              select: { teacher: { select: { id: true, name: true } } },
              orderBy: { createdAt: "asc" },
            },
            poloLocation: {
              select: { name: true, polo: { select: { name: true } } },
            },
            _count: { select: { sessions: true } },
          },
          orderBy: [{ course: { name: "asc" } }, { startDate: "asc" }],
        });

  const classGroupOptions = classGroupsRaw.map((cg) => {
    const loc = cg.location?.trim() || cg.poloLocation?.name || "";
    const date = cg.startDate
      ? `${String(cg.startDate.getUTCDate()).padStart(2, "0")}/${String(cg.startDate.getUTCMonth() + 1).padStart(2, "0")}`
      : "";
    return {
      id: cg.id,
      cycleId: cg.cycleId,
      label: `${cg.course.name}${loc ? ` · ${loc}` : ""}${date ? ` · ${date}` : ""}`,
    };
  });

  if (cycleIds.length === 0) {
    return {
      filtersApplied: { ...filters, cycleIds },
      ...options,
      classGroups: [],
      summary: [
        metric("turmas", "Turmas no filtro", null, {
          hint: "Selecione ao menos um ciclo (ou ano/número de ciclo) para carregar o resumo.",
        }),
        metric("alunos", "Alunos (vagas preenchidas)", null, {
          hint: "Sem ciclo selecionado — não há base para contar alunos.",
        }),
        metric("frequencia", "Frequência média", null, {
          hint: "Sem dados — escolha um ciclo.",
          suffix: "%",
        }),
        metric("formados", "Formados", null, {
          hint: "Sem dados — escolha um ciclo.",
        }),
      ],
      byStatus: [],
      turmaRows: [],
      notes: [
        ...notes,
        "Os indicadores só são calculados a partir de turmas e matrículas reais do(s) ciclo(s) filtrado(s).",
      ],
    };
  }

  if (classGroupsRaw.length === 0) {
    notes.push("Não há turmas (não canceladas) que correspondam aos filtros aplicados.");
    return {
      filtersApplied: { ...filters, cycleIds },
      ...options,
      classGroups: classGroupOptions,
      summary: [
        metric("turmas", "Turmas no filtro", 0, {
          hint: "Nenhuma turma encontrada com estes filtros.",
        }),
        metric("alunos", "Alunos distintos (vagas)", 0, {
          hint: "Sem turmas no filtro.",
        }),
        metric("inscritos", "Matrículas (ACTIVE+SUSPENDED)", 0),
        metric("ocupacao", "Ocupação média", null, {
          hint: "Sem turmas com capacidade para calcular ocupação.",
          suffix: "%",
        }),
        metric("frequencia", "Frequência média", null, {
          hint: "Sem frequência lançada neste filtro.",
          suffix: "%",
        }),
        metric("formados", "Formados (turma encerrada + apto)", 0, {
          hint: "Só conta alunos aptos a certificado em turmas ENCERRADAS.",
        }),
      ],
      byStatus: [],
      turmaRows: [],
      notes,
    };
  }

  const classGroupIds = classGroupsRaw.map((cg) => cg.id);

  const enrollments = await prisma.enrollment.findMany({
    where: { classGroupId: { in: classGroupIds } },
    select: {
      id: true,
      studentId: true,
      classGroupId: true,
      status: true,
      isPreEnrollment: true,
      certificateEligible: true,
      certificateIssuedAt: true,
    },
  });

  const encerradaIds = new Set(
    classGroupsRaw.filter((c) => c.status === "ENCERRADA").map((c) => c.id),
  );
  await syncCertificateEligibleFromAttendance(
    enrollments.filter((e) => encerradaIds.has(e.classGroupId)).map((e) => e.id),
  );

  const refreshedEligible =
    enrollments.length === 0
      ? []
      : await prisma.enrollment.findMany({
          where: { id: { in: enrollments.map((e) => e.id) } },
          select: { id: true, certificateEligible: true },
        });
  const eligibleById = new Map(refreshedEligible.map((r) => [r.id, r.certificateEligible]));

  const occupying = enrollments.filter((e) => enrollmentOccupiesSeat(e.status));
  const attendanceMap = await getEnrollmentAttendanceSummaries(occupying.map((e) => e.id));

  // Sessões até o fim do dia (Brasil) vs com pelo menos um lançamento de presença.
  const endOfTodayBrazil = getEndOfTodayBrazil();

  const sessions = await prisma.classSession.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      status: { not: "CANCELED" },
      sessionDate: { lte: endOfTodayBrazil },
    },
    select: {
      id: true,
      classGroupId: true,
      _count: { select: { sessionAttendances: true } },
    },
  });

  const pastSessionsByCg = new Map<string, number>();
  const calledSessionsByCg = new Map<string, number>();
  for (const s of sessions) {
    pastSessionsByCg.set(s.classGroupId, (pastSessionsByCg.get(s.classGroupId) ?? 0) + 1);
    if (s._count.sessionAttendances > 0) {
      calledSessionsByCg.set(s.classGroupId, (calledSessionsByCg.get(s.classGroupId) ?? 0) + 1);
    }
  }

  const enrollmentsByCg = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const list = enrollmentsByCg.get(e.classGroupId) ?? [];
    list.push(e);
    enrollmentsByCg.set(e.classGroupId, list);
  }

  const turmaRows: PedagogicalClassGroupRow[] = [];
  const statusCounts = new Map<string, number>();
  const ocupacaoPercents: number[] = [];
  const frequenciaPercents: number[] = [];
  let totalInscritos = 0;
  let totalCapacity = 0;
  let totalFormados = 0;
  let totalBaseFormacao = 0;
  let preEnrollmentCount = 0;
  let certificatesIssued = 0;
  const studentIds = new Set<string>();

  for (const cg of classGroupsRaw) {
    statusCounts.set(cg.status, (statusCounts.get(cg.status) ?? 0) + 1);
    const rows = enrollmentsByCg.get(cg.id) ?? [];
    const inscritos = rows.filter((e) => enrollmentOccupiesSeat(e.status)).length;
    totalInscritos += inscritos;
    totalCapacity += cg.capacity;
    totalBaseFormacao += inscritos;

    for (const e of rows) {
      if (enrollmentOccupiesSeat(e.status)) studentIds.add(e.studentId);
      if (e.isPreEnrollment && e.status === "ACTIVE") preEnrollmentCount += 1;
      if (e.certificateIssuedAt) certificatesIssued += 1;
    }

    const isEncerrada = cg.status === "ENCERRADA";
    const formados = isEncerrada
      ? rows.filter(
          (e) =>
            (e.status === "ACTIVE" || e.status === "SUSPENDED" || e.status === "COMPLETED") &&
            eligibleById.get(e.id) === true,
        ).length
      : 0;
    totalFormados += formados;

    const occupyingIds = rows.filter((e) => enrollmentOccupiesSeat(e.status)).map((e) => e.id);
    const freqs: number[] = [];
    for (const id of occupyingIds) {
      const a = attendanceMap.get(id);
      if (a && a.percent != null) freqs.push(a.percent);
    }
    const frequenciaMediaPercent = avg(freqs);
    if (frequenciaMediaPercent != null) frequenciaPercents.push(frequenciaMediaPercent);

    const ocupacaoPercent = pct(inscritos, cg.capacity);
    if (ocupacaoPercent != null) ocupacaoPercents.push(ocupacaoPercent);

    const teacherNames = [
      ...new Set(
        [
          cg.teacher?.name,
          ...cg.classGroupTeachers.map((t) => t.teacher.name),
        ].filter((n): n is string => Boolean(n)),
      ),
    ];

    const locParts = [
      cg.poloLocation?.polo?.name,
      cg.poloLocation?.name ?? cg.location?.trim() ?? "",
    ].filter(Boolean);

    turmaRows.push({
      id: cg.id,
      courseName: cg.course.name,
      teachers: teacherNames.join(", ") || "—",
      status: cg.status,
      statusLabel: STATUS_LABEL[cg.status] ?? cg.status,
      cycleLabel: `${cg.cycle.cycle}/${cg.cycle.year}`,
      location: locParts.join(" · ") || "—",
      capacity: cg.capacity,
      inscritos,
      ocupacaoPercent,
      formados,
      taxaFormadosPercent: isEncerrada ? pct(formados, inscritos) : null,
      frequenciaMediaPercent,
      sessoesComChamada: calledSessionsByCg.get(cg.id) ?? 0,
      sessoesPassadas: pastSessionsByCg.get(cg.id) ?? 0,
      isExternal: cg.isExternal,
    });
  }

  const pastSessionsTotal = [...pastSessionsByCg.values()].reduce((a, b) => a + b, 0);
  const calledSessionsTotal = [...calledSessionsByCg.values()].reduce((a, b) => a + b, 0);

  if (frequenciaPercents.length === 0) {
    notes.push(
      "Frequência média indisponível: não há lançamentos de presença nas matrículas deste filtro (ou ainda não há aulas passadas).",
    );
  }
  if (totalBaseFormacao === 0) {
    notes.push("Não há alunos ocupando vaga (ACTIVE/SUSPENDED) neste filtro.");
  }
  const encerradas = classGroupsRaw.filter((c) => c.status === "ENCERRADA").length;
  if (encerradas === 0) {
    notes.push(
      "Formados só são contabilizados em turmas com status ENCERRADA e aluno apto a certificado (≥70% de presença ou marcação manual).",
    );
  }
  if (pastSessionsTotal > 0 && calledSessionsTotal < pastSessionsTotal) {
    notes.push(
      `Chamada incompleta: ${calledSessionsTotal} de ${pastSessionsTotal} aula(s) passada(s) têm frequência lançada.`,
    );
  }

  const freqAvg = avg(frequenciaPercents);
  const ocupAvg = avg(ocupacaoPercents);
  const taxaFormados = pct(totalFormados, totalBaseFormacao);

  const summary: PedagogicalMetric[] = [
    metric("turmas", "Turmas no filtro", classGroupsRaw.length),
    metric("alunos", "Alunos distintos (vagas)", studentIds.size, {
      hint:
        studentIds.size === 0
          ? "Nenhum aluno com matrícula ACTIVE ou SUSPENDED neste filtro."
          : "Contagem distinta de alunos com vaga preenchida (ACTIVE + SUSPENDED).",
    }),
    metric("inscritos", "Matrículas (ACTIVE+SUSPENDED)", totalInscritos),
    metric("preMatriculas", "Pré-matrículas (ACTIVE)", preEnrollmentCount, {
      hint: "Matrículas ACTIVE ainda marcadas como pré-matrícula.",
    }),
    metric("ocupacao", "Ocupação média das turmas", ocupAvg, {
      hint:
        ocupAvg == null
          ? "Sem capacidade/inscritos suficientes para calcular."
          : "Média das taxas inscritos÷capacidade por turma.",
      suffix: "%",
    }),
    metric("frequencia", "Frequência média", freqAvg, {
      hint:
        freqAvg == null
          ? "Sem dados de frequência lançada neste filtro."
          : "Média das frequências % das matrículas com vaga (aulas ≤ hoje, não canceladas).",
      suffix: "%",
    }),
    metric("formados", "Formados", totalFormados, {
      hint:
        encerradas === 0
          ? "Nenhuma turma encerrada no filtro — formados = 0 por definição."
          : "Alunos aptos a certificado em turmas ENCERRADAS.",
    }),
    metric("taxaFormados", "Taxa de formados", taxaFormados, {
      hint:
        taxaFormados == null
          ? "Sem base (sem inscritos) para taxa de formados."
          : "Formados ÷ (ACTIVE + SUSPENDED) no filtro.",
      suffix: "%",
    }),
    metric("certificadosEmitidos", "Certificados emitidos", certificatesIssued, {
      hint: "Matrículas com data de emissão de certificado registrada.",
    }),
    metric("chamadas", "Aulas passadas com chamada", calledSessionsTotal, {
      hint:
        pastSessionsTotal === 0
          ? "Ainda não há aulas com data até hoje neste filtro."
          : `${calledSessionsTotal} de ${pastSessionsTotal} aula(s) passada(s).`,
    }),
  ];

  return {
    filtersApplied: { ...filters, cycleIds },
    ...options,
    classGroups: classGroupOptions,
    summary,
    byStatus: [...statusCounts.entries()]
      .map(([status, count]) => ({
        status,
        label: STATUS_LABEL[status] ?? status,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    turmaRows,
    notes,
  };
}
