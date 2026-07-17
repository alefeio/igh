import "server-only";

import * as XLSX from "xlsx";

import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";
import { syncCertificateEligibleFromAttendance } from "@/lib/enrollment-certificate-eligibility-sync";
import { prisma } from "@/lib/prisma";

const DAY_LABEL: Record<string, string> = {
  SUNDAY: "Dom",
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
};

const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
  INTERNO: "Interno",
  EXTERNO: "Externo",
};

export type CycleClassGroupReportRow = {
  cycleLabel: string;
  courseName: string;
  teachers: string;
  daysOfWeek: string;
  schedule: string;
  location: string;
  status: string;
  statusLabel: string;
  capacity: number;
  inscritos: number;
  ocupacaoPercent: number | null;
  suspensos: number;
  cancelados: number;
  /** ACTIVE + SUSPENDED (base da taxa de formados). */
  baseFormacao: number;
  /** certificateEligible e turma ENCERRADA. */
  formados: number;
  taxaFormadosPercent: number | null;
  frequenciaMediaPercent: number | null;
  sessoes: number;
  startDate: string;
  endDate: string;
};

export type CycleCourseReportRow = {
  courseName: string;
  turmas: number;
  capacity: number;
  inscritos: number;
  ocupacaoPercent: number | null;
  suspensos: number;
  formados: number;
  baseFormacao: number;
  taxaFormadosPercent: number | null;
  frequenciaMediaPercent: number | null;
};

function formatDays(days: string[]): string {
  return days.map((d) => DAY_LABEL[d] ?? d).join(", ");
}

function formatDateOnly(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}/${m}/${y}`;
}

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

/**
 * Relatório de turmas do ciclo (exclui CANCELADA; inclui INTERNO/EXTERNO).
 * Inscritos = ACTIVE · Formados = Certificado Sim + turma ENCERRADA ·
 * Taxa = formados / (ACTIVE + SUSPENDED).
 */
export async function buildCycleClassGroupsReport(cycleId: string): Promise<{
  cycle: { cycle: number; year: number };
  turmaRows: CycleClassGroupReportRow[];
  courseRows: CycleCourseReportRow[];
}> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { id: true, cycle: true, year: true },
  });
  if (!cycle) {
    throw new Error("Ciclo não encontrado.");
  }

  const classGroups = await prisma.classGroup.findMany({
    where: {
      cycleId,
      status: { not: "CANCELADA" },
    },
    select: {
      id: true,
      status: true,
      capacity: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      startDate: true,
      endDate: true,
      location: true,
      course: { select: { id: true, name: true } },
      teacher: { select: { name: true } },
      classGroupTeachers: {
        select: { teacher: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      poloLocation: {
        select: { name: true, polo: { select: { name: true } } },
      },
    },
    orderBy: [{ course: { name: "asc" } }, { startDate: "asc" }, { startTime: "asc" }],
  });

  const classGroupIds = classGroups.map((cg) => cg.id);
  const cycleLabel = `${cycle.cycle}/${String(cycle.year).slice(-2)}`;

  const enrollments =
    classGroupIds.length === 0
      ? []
      : await prisma.enrollment.findMany({
          where: {
            classGroupId: { in: classGroupIds },
            isPreEnrollment: false,
          },
          select: {
            id: true,
            classGroupId: true,
            status: true,
            certificateEligible: true,
          },
        });

  // Atualiza aptidão por ≥70% (não sobrescreve bloqueio manual).
  await syncCertificateEligibleFromAttendance(enrollments.map((e) => e.id));

  const refreshedEligible =
    enrollments.length === 0
      ? []
      : await prisma.enrollment.findMany({
          where: { id: { in: enrollments.map((e) => e.id) } },
          select: { id: true, certificateEligible: true },
        });
  const eligibleById = new Map(refreshedEligible.map((r) => [r.id, r.certificateEligible]));

  const attendanceIds = enrollments
    .filter((e) => e.status === "ACTIVE" || e.status === "SUSPENDED")
    .map((e) => e.id);
  const attendanceMap = await getEnrollmentAttendanceSummaries(attendanceIds);

  const enrollmentsByCg = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const list = enrollmentsByCg.get(e.classGroupId) ?? [];
    list.push(e);
    enrollmentsByCg.set(e.classGroupId, list);
  }

  const turmaRows: CycleClassGroupReportRow[] = [];

  for (const cg of classGroups) {
    const rows = enrollmentsByCg.get(cg.id) ?? [];
    const inscritos = rows.filter((e) => e.status === "ACTIVE").length;
    const suspensos = rows.filter((e) => e.status === "SUSPENDED").length;
    const cancelados = rows.filter((e) => e.status === "CANCELLED").length;
    const baseFormacao = inscritos + suspensos;

    const isEncerrada = cg.status === "ENCERRADA";
    const formados = isEncerrada
      ? rows.filter(
          (e) =>
            (e.status === "ACTIVE" || e.status === "SUSPENDED" || e.status === "COMPLETED") &&
            eligibleById.get(e.id) === true,
        ).length
      : 0;

    const freqPercents: number[] = [];
    let sessoes = 0;
    for (const e of rows) {
      if (e.status !== "ACTIVE" && e.status !== "SUSPENDED") continue;
      const summary = attendanceMap.get(e.id);
      if (summary) {
        sessoes = Math.max(sessoes, summary.totalSessions);
        if (summary.percent != null) freqPercents.push(summary.percent);
      }
    }

    const teacherNames = [
      ...new Set(
        [
          ...cg.classGroupTeachers.map((t) => t.teacher.name.trim()),
          cg.teacher.name.trim(),
        ].filter(Boolean),
      ),
    ];

    const location =
      cg.poloLocation != null
        ? `${cg.poloLocation.polo.name} — ${cg.poloLocation.name}`
        : (cg.location ?? "").trim();

    turmaRows.push({
      cycleLabel,
      courseName: cg.course.name,
      teachers: teacherNames.join(", "),
      daysOfWeek: formatDays(cg.daysOfWeek),
      schedule: `${cg.startTime}–${cg.endTime}`,
      location,
      status: cg.status,
      statusLabel: STATUS_LABEL[cg.status] ?? cg.status,
      capacity: cg.capacity,
      inscritos,
      ocupacaoPercent: pct(inscritos, cg.capacity),
      suspensos,
      cancelados,
      baseFormacao,
      formados,
      taxaFormadosPercent: pct(formados, baseFormacao),
      frequenciaMediaPercent: avg(freqPercents),
      sessoes,
      startDate: formatDateOnly(cg.startDate),
      endDate: formatDateOnly(cg.endDate),
    });
  }

  const byCourse = new Map<
    string,
    {
      courseName: string;
      turmas: number;
      capacity: number;
      inscritos: number;
      suspensos: number;
      formados: number;
      baseFormacao: number;
      freqSamples: number[];
    }
  >();

  for (const row of turmaRows) {
    const key = row.courseName;
    const bucket = byCourse.get(key) ?? {
      courseName: row.courseName,
      turmas: 0,
      capacity: 0,
      inscritos: 0,
      suspensos: 0,
      formados: 0,
      baseFormacao: 0,
      freqSamples: [],
    };
    bucket.turmas += 1;
    bucket.capacity += row.capacity;
    bucket.inscritos += row.inscritos;
    bucket.suspensos += row.suspensos;
    bucket.formados += row.formados;
    bucket.baseFormacao += row.baseFormacao;
    if (row.frequenciaMediaPercent != null) {
      bucket.freqSamples.push(row.frequenciaMediaPercent);
    }
    byCourse.set(key, bucket);
  }

  const courseRows: CycleCourseReportRow[] = [...byCourse.values()]
    .sort((a, b) => a.courseName.localeCompare(b.courseName, "pt-BR"))
    .map((b) => ({
      courseName: b.courseName,
      turmas: b.turmas,
      capacity: b.capacity,
      inscritos: b.inscritos,
      ocupacaoPercent: pct(b.inscritos, b.capacity),
      suspensos: b.suspensos,
      formados: b.formados,
      baseFormacao: b.baseFormacao,
      taxaFormadosPercent: pct(b.formados, b.baseFormacao),
      frequenciaMediaPercent: avg(b.freqSamples),
    }));

  return { cycle: { cycle: cycle.cycle, year: cycle.year }, turmaRows, courseRows };
}

export function buildCycleClassGroupsReportXlsx(params: {
  cycle: { cycle: number; year: number };
  turmaRows: CycleClassGroupReportRow[];
  courseRows: CycleCourseReportRow[];
}): Buffer {
  const glossario = [
    ["Campo", "Significado"],
    ["Inscritos", "Matrículas com status ACTIVE"],
    ["Suspensos", "Matrículas com status SUSPENDED"],
    ["Base formação", "Inscritos (ACTIVE) + Suspensos"],
    [
      "Formados",
      "Alunos com Certificado = Sim (aptos) e turma ENCERRADA",
    ],
    ["Taxa formados %", "Formados ÷ Base formação × 100"],
    [
      "Freq. média %",
      "Média das frequências individuais (ACTIVE e SUSPENDED); sessões até hoje, exceto canceladas",
    ],
    ["Ocupação %", "Inscritos ÷ Capacidade × 100"],
    ["Turmas incluídas", "Todas do ciclo, exceto CANCELADA (inclui INTERNO e EXTERNO)"],
  ];

  const turmaHeader = [
    "Ciclo",
    "Curso",
    "Professor(es)",
    "Dias",
    "Horário",
    "Local",
    "Status",
    "Capacidade",
    "Inscritos",
    "Ocupação %",
    "Suspensos",
    "Cancelados",
    "Base formação",
    "Formados",
    "Taxa formados %",
    "Freq. média %",
    "Aulas (sessões)",
    "Início",
    "Fim",
  ];

  const turmaAoA = [
    turmaHeader,
    ...params.turmaRows.map((r) => [
      r.cycleLabel,
      r.courseName,
      r.teachers,
      r.daysOfWeek,
      r.schedule,
      r.location,
      r.statusLabel,
      r.capacity,
      r.inscritos,
      r.ocupacaoPercent ?? "",
      r.suspensos,
      r.cancelados,
      r.baseFormacao,
      r.formados,
      r.taxaFormadosPercent ?? "",
      r.frequenciaMediaPercent ?? "",
      r.sessoes,
      r.startDate,
      r.endDate,
    ]),
  ];

  const courseHeader = [
    "Curso",
    "Turmas",
    "Capacidade total",
    "Inscritos",
    "Ocupação %",
    "Suspensos",
    "Formados",
    "Base formação",
    "Taxa formados %",
    "Freq. média %",
  ];

  const courseAoA = [
    courseHeader,
    ...params.courseRows.map((r) => [
      r.courseName,
      r.turmas,
      r.capacity,
      r.inscritos,
      r.ocupacaoPercent ?? "",
      r.suspensos,
      r.formados,
      r.baseFormacao,
      r.taxaFormadosPercent ?? "",
      r.frequenciaMediaPercent ?? "",
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(turmaAoA), "Turmas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(courseAoA), "Por curso");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(glossario), "Glossário");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
