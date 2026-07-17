import "server-only";

import ExcelJS from "exceljs";

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

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
  name: "Calibri",
};
const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FF1F4E79" },
  name: "Calibri",
};
const BODY_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 11 };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
};
const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

function autoWidth(worksheet: ExcelJS.Worksheet, min = 8, max = 42) {
  worksheet.columns.forEach((column) => {
    if (!column || typeof column.eachCell !== "function") return;
    let longest = min;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      let len = 0;
      if (v == null) len = 0;
      else if (typeof v === "object" && "text" in v && typeof (v as { text?: string }).text === "string") {
        len = (v as { text: string }).text.length;
      } else if (typeof v === "object" && "result" in v) {
        len = String((v as { result?: unknown }).result ?? "").length;
      } else {
        len = String(v).length;
      }
      if (len > longest) longest = len;
    });
    column.width = Math.min(max, Math.max(min, longest + 2));
  });
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 22;
  row.font = HEADER_FONT;
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.font = HEADER_FONT;
  }
}

function styleDataRow(row: ExcelJS.Row, colCount: number, alt: boolean) {
  row.font = BODY_FONT;
  row.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = THIN_BORDER;
    if (alt) cell.fill = ALT_ROW_FILL;
  }
}

function setNum(cell: ExcelJS.Cell, value: number | null | undefined, format?: string) {
  if (value == null || Number.isNaN(value)) {
    cell.value = "—";
    cell.alignment = { horizontal: "center", vertical: "middle" };
    return;
  }
  cell.value = value;
  if (format) cell.numFmt = format;
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

export async function buildCycleClassGroupsReportXlsx(params: {
  cycle: { cycle: number; year: number };
  turmaRows: CycleClassGroupReportRow[];
  courseRows: CycleCourseReportRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cadastro Cursos IGH";
  wb.created = new Date();
  const title = `Relatório do ciclo ${params.cycle.cycle}/${params.cycle.year}`;
  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Belem" });

  // --- Turmas ---
  const wsTurmas = wb.addWorksheet("Turmas", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  const turmaHeaders = [
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

  wsTurmas.mergeCells(1, 1, 1, turmaHeaders.length);
  const titleCell = wsTurmas.getCell(1, 1);
  titleCell.value = `${title} — Turmas`;
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  wsTurmas.getRow(1).height = 26;

  const headerRowTurmas = wsTurmas.getRow(2);
  turmaHeaders.forEach((h, i) => {
    headerRowTurmas.getCell(i + 1).value = h;
  });
  styleHeaderRow(headerRowTurmas, turmaHeaders.length);

  params.turmaRows.forEach((r, idx) => {
    const row = wsTurmas.getRow(idx + 3);
    row.getCell(1).value = r.cycleLabel;
    row.getCell(2).value = r.courseName;
    row.getCell(3).value = r.teachers;
    row.getCell(4).value = r.daysOfWeek;
    row.getCell(5).value = r.schedule;
    row.getCell(6).value = r.location || "—";
    row.getCell(7).value = r.statusLabel;
    setNum(row.getCell(8), r.capacity, "0");
    setNum(row.getCell(9), r.inscritos, "0");
    setNum(row.getCell(10), r.ocupacaoPercent, "0.0");
    setNum(row.getCell(11), r.suspensos, "0");
    setNum(row.getCell(12), r.cancelados, "0");
    setNum(row.getCell(13), r.baseFormacao, "0");
    setNum(row.getCell(14), r.formados, "0");
    setNum(row.getCell(15), r.taxaFormadosPercent, "0.0");
    setNum(row.getCell(16), r.frequenciaMediaPercent, "0.0");
    setNum(row.getCell(17), r.sessoes, "0");
    row.getCell(18).value = r.startDate || "—";
    row.getCell(19).value = r.endDate || "—";
    row.getCell(18).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(19).alignment = { horizontal: "center", vertical: "middle" };
    styleDataRow(row, turmaHeaders.length, idx % 2 === 1);
  });

  const turmaLastRow = 2 + params.turmaRows.length;
  if (params.turmaRows.length > 0) {
    wsTurmas.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: turmaLastRow, column: turmaHeaders.length },
    };
  }
  autoWidth(wsTurmas);
  wsTurmas.getColumn(2).width = Math.max(Number(wsTurmas.getColumn(2).width ?? 20), 28);
  wsTurmas.getColumn(3).width = Math.max(Number(wsTurmas.getColumn(3).width ?? 16), 22);
  wsTurmas.getColumn(6).width = Math.max(Number(wsTurmas.getColumn(6).width ?? 14), 20);

  // --- Por curso ---
  const wsCurso = wb.addWorksheet("Por curso", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  const courseHeaders = [
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

  wsCurso.mergeCells(1, 1, 1, courseHeaders.length);
  const courseTitle = wsCurso.getCell(1, 1);
  courseTitle.value = `${title} — Resumo por curso`;
  courseTitle.font = TITLE_FONT;
  courseTitle.alignment = { vertical: "middle", horizontal: "left" };
  wsCurso.getRow(1).height = 26;

  const headerRowCurso = wsCurso.getRow(2);
  courseHeaders.forEach((h, i) => {
    headerRowCurso.getCell(i + 1).value = h;
  });
  styleHeaderRow(headerRowCurso, courseHeaders.length);

  params.courseRows.forEach((r, idx) => {
    const row = wsCurso.getRow(idx + 3);
    row.getCell(1).value = r.courseName;
    setNum(row.getCell(2), r.turmas, "0");
    setNum(row.getCell(3), r.capacity, "0");
    setNum(row.getCell(4), r.inscritos, "0");
    setNum(row.getCell(5), r.ocupacaoPercent, "0.0");
    setNum(row.getCell(6), r.suspensos, "0");
    setNum(row.getCell(7), r.formados, "0");
    setNum(row.getCell(8), r.baseFormacao, "0");
    setNum(row.getCell(9), r.taxaFormadosPercent, "0.0");
    setNum(row.getCell(10), r.frequenciaMediaPercent, "0.0");
    styleDataRow(row, courseHeaders.length, idx % 2 === 1);
  });

  const courseLastRow = 2 + params.courseRows.length;
  if (params.courseRows.length > 0) {
    wsCurso.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: courseLastRow, column: courseHeaders.length },
    };
  }
  autoWidth(wsCurso);
  wsCurso.getColumn(1).width = Math.max(Number(wsCurso.getColumn(1).width ?? 20), 32);

  // --- Glossário ---
  const wsGloss = wb.addWorksheet("Glossário", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    properties: { defaultRowHeight: 22 },
  });

  wsGloss.mergeCells(1, 1, 1, 2);
  const glossTitle = wsGloss.getCell(1, 1);
  glossTitle.value = `${title} — Glossário (gerado em ${generatedAt})`;
  glossTitle.font = TITLE_FONT;
  glossTitle.alignment = { vertical: "middle", horizontal: "left" };
  wsGloss.getRow(1).height = 26;

  const glossHeader = wsGloss.getRow(2);
  glossHeader.getCell(1).value = "Campo";
  glossHeader.getCell(2).value = "Significado";
  styleHeaderRow(glossHeader, 2);

  const glossario: [string, string][] = [
    ["Inscritos", "Matrículas com status ACTIVE"],
    ["Suspensos", "Matrículas com status SUSPENDED"],
    ["Base formação", "Inscritos (ACTIVE) + Suspensos"],
    ["Formados", "Alunos com Certificado = Sim (aptos) e turma ENCERRADA"],
    ["Taxa formados %", "Formados ÷ Base formação × 100"],
    [
      "Freq. média %",
      "Média das frequências individuais (ACTIVE e SUSPENDED); sessões até hoje, exceto canceladas",
    ],
    ["Ocupação %", "Inscritos ÷ Capacidade × 100"],
    ["Turmas incluídas", "Todas do ciclo, exceto CANCELADA (inclui INTERNO e EXTERNO)"],
  ];

  glossario.forEach(([campo, significado], idx) => {
    const row = wsGloss.getRow(idx + 3);
    row.getCell(1).value = campo;
    row.getCell(2).value = significado;
    styleDataRow(row, 2, idx % 2 === 1);
    row.getCell(1).font = { ...BODY_FONT, bold: true };
    row.getCell(2).alignment = { vertical: "middle", wrapText: true };
  });

  wsGloss.getColumn(1).width = 22;
  wsGloss.getColumn(2).width = 92;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
