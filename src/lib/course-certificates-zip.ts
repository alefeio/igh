import "server-only";

import JSZip from "jszip";

import { resolveCertificateIssuedAt } from "@/lib/course-certificate-eligibility";
import {
  parseCertificateZipPages,
  studentCertificatePdfFileName,
  slugPart,
  type CertificateZipPages,
} from "@/lib/course-certificate-pdf-naming";
import {
  fetchCertificateSignatureBytes,
  generateCourseCompletionCertificatePdfBytes,
  type CourseCompletionCertificateInput,
} from "@/lib/course-completion-certificate";
import { resolveCertificateIssuePlace } from "@/lib/certificate-issue-place";
import {
  CYCLE_CERTIFICATE_ZIP_MAX_BYTES,
  CYCLE_CERTIFICATE_ZIP_MAX_FILES,
  cycleCertificatePdfFileName,
  shouldAcceptNextCertificate,
} from "@/lib/certificate-zip-chunk";
import {
  certificateZipStatusWhere,
  classGroupCertificateEnrollmentWhere,
  classGroupsCertificateEnrollmentWhere,
  cycleCertificateEnrollmentWhere,
} from "@/lib/certificate-zip-enrollment";
import { syncCertificateEligibleFromAttendance } from "@/lib/enrollment-certificate-eligibility-sync";
import { prisma } from "@/lib/prisma";

export type { CertificateZipPages };
export { parseCertificateZipPages, slugPart, studentCertificatePdfFileName };

type EnrollmentRow = {
  id: string;
  student: { name: string };
  certificateUrl?: string | null;
  certificateIssuedAt?: Date | null;
  status?: string;
  updatedAt?: Date;
};

/** Quantos PDFs gerar em paralelo no ZIP (equilíbrio entre latência e memória). */
const CERTIFICATE_ZIP_CONCURRENCY = 3;

type SharedCourseCertificateContext = {
  courseName: string;
  workloadHours: number | null;
  moduleTitles: string[];
  teacherName: string;
  teacherSignatureUrl: string | null;
  teacherSignatureBytes: { bytes: Uint8Array; contentType: string } | null;
  classGroupEndDate: Date | null;
  issueCity: string;
  issueCityState: string;
};

async function loadSharedCourseCertificateContext(
  classGroupId: string,
): Promise<SharedCourseCertificateContext> {
  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: {
      endDate: true,
      course: {
        select: {
          id: true,
          name: true,
          workloadHours: true,
          modules: { orderBy: { order: "asc" }, select: { title: true } },
        },
      },
      teacher: { select: { name: true, signatureUrl: true } },
      poloLocation: { select: { city: true, state: true } },
    },
  });
  if (!classGroup) throw new Error("Turma não encontrada.");

  // Cidade: polo → site → env (mesma ordem de resolveCertificateIssuePlace, sem N queries).
  let issueCity = classGroup.poloLocation?.city?.trim() ?? "";
  let issueState = classGroup.poloLocation?.state?.trim() ?? "";
  if (!issueCity && !issueState) {
    const settings = await prisma.siteSettings.findFirst({
      select: { certificateCity: true, certificateCityState: true },
    });
    issueCity = settings?.certificateCity?.trim() ?? "";
    issueState = settings?.certificateCityState?.trim() ?? "";
  }
  if (!issueCity && !issueState) {
    issueCity = process.env.CERTIFICATE_CITY?.trim() ?? "";
    issueState = process.env.CERTIFICATE_CITY_STATE?.trim() ?? "";
  }
  const issueCityState =
    issueCity && issueState ? `${issueCity}/${issueState}` : issueCity || issueState || "";

  const teacherSignatureUrl = classGroup.teacher.signatureUrl;
  const teacherSignatureBytes = await fetchCertificateSignatureBytes(teacherSignatureUrl);

  return {
    courseName: classGroup.course.name,
    workloadHours: classGroup.course.workloadHours,
    moduleTitles: classGroup.course.modules.map((m) => m.title).filter(Boolean),
    teacherName: classGroup.teacher.name,
    teacherSignatureUrl,
    teacherSignatureBytes,
    classGroupEndDate: classGroup.endDate,
    issueCity,
    issueCityState,
  };
}

async function fetchCachedCertificatePdf(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Gera (ou reutiliza cache) o PDF de um aluno usando o contexto compartilhado da turma.
 * Evita recarregar módulos/aulas e a assinatura a cada matrícula.
 */
async function generateCertificateForZipRow(
  row: EnrollmentRow,
  shared: SharedCourseCertificateContext,
  pages: CertificateZipPages,
  options?: { compact?: boolean },
): Promise<{ pdfBytes: Uint8Array; studentName: string }> {
  const studentName = row.student.name?.trim() || "Aluno";

  // Cache só cobre frente+verso em tamanho cheio. O lote compacto regenera para caber no download.
  if (!options?.compact && pages === "both" && row.certificateUrl) {
    const cached = await fetchCachedCertificatePdf(row.certificateUrl);
    if (cached) return { pdfBytes: cached, studentName };
  }

  const issuedAt = resolveCertificateIssuedAt({
    certificateIssuedAt: row.certificateIssuedAt ?? null,
    status: row.status ?? "ACTIVE",
    updatedAt: row.updatedAt ?? new Date(),
    classGroupEndDate: shared.classGroupEndDate,
  });

  const input: CourseCompletionCertificateInput = {
    studentName,
    courseName: shared.courseName,
    workloadHours: shared.workloadHours,
    moduleTitles: shared.moduleTitles,
    teacherName: shared.teacherName,
    teacherSignatureUrl: shared.teacherSignatureUrl,
    teacherSignatureBytes: shared.teacherSignatureBytes,
    issuedAt,
    issueCity: shared.issueCity,
    issueCityState: shared.issueCityState,
  };

  const pdfBytes = await generateCourseCompletionCertificatePdfBytes(input, {
    pages,
    compact: options?.compact === true,
  });
  return { pdfBytes, studentName };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!, index);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () =>
    run(),
  );
  await Promise.all(runners);
  return results;
}

export async function addEnrollmentCertificatesToZip(
  zip: JSZip,
  enrollments: EnrollmentRow[],
  pages: CertificateZipPages,
  errors: string[],
  sharedByClassGroupId?: Map<string, SharedCourseCertificateContext>,
  classGroupIdForAll?: string,
): Promise<number> {
  const usedNames = new Set<string>();
  let added = 0;

  // Quando todas as matrículas são da mesma turma, carrega o contexto uma vez.
  let shared: SharedCourseCertificateContext | null = null;
  if (classGroupIdForAll) {
    shared =
      sharedByClassGroupId?.get(classGroupIdForAll) ??
      (await loadSharedCourseCertificateContext(classGroupIdForAll));
    sharedByClassGroupId?.set(classGroupIdForAll, shared);
  }

  const outcomes = await mapPool(enrollments, CERTIFICATE_ZIP_CONCURRENCY, async (row) => {
    try {
      let ctx = shared;
      if (!ctx) {
        // Fallback legado (chamadas avulsas): resolve lugar por matrícula.
        const place = await resolveCertificateIssuePlace(row.id);
        const enrollment = await prisma.enrollment.findUnique({
          where: { id: row.id },
          select: {
            certificateIssuedAt: true,
            status: true,
            updatedAt: true,
            classGroupId: true,
            classGroup: {
              select: {
                endDate: true,
                course: {
                  select: {
                    name: true,
                    workloadHours: true,
                    modules: { orderBy: { order: "asc" }, select: { title: true } },
                  },
                },
                teacher: { select: { name: true, signatureUrl: true } },
              },
            },
          },
        });
        if (!enrollment) throw new Error("Matrícula não encontrada.");
        ctx = {
          courseName: enrollment.classGroup.course.name,
          workloadHours: enrollment.classGroup.course.workloadHours,
          moduleTitles: enrollment.classGroup.course.modules.map((m) => m.title),
          teacherName: enrollment.classGroup.teacher.name,
          teacherSignatureUrl: enrollment.classGroup.teacher.signatureUrl,
          teacherSignatureBytes: await fetchCertificateSignatureBytes(
            enrollment.classGroup.teacher.signatureUrl,
          ),
          classGroupEndDate: enrollment.classGroup.endDate,
          issueCity: place.city,
          issueCityState: place.cityState,
        };
        row = {
          ...row,
          certificateIssuedAt: enrollment.certificateIssuedAt,
          status: enrollment.status,
          updatedAt: enrollment.updatedAt,
        };
      }
      const generated = await generateCertificateForZipRow(row, ctx, pages);
      return { ok: true as const, row, generated };
    } catch (e) {
      return {
        ok: false as const,
        row,
        message: e instanceof Error ? e.message : "falha",
      };
    }
  });

  for (const outcome of outcomes) {
    if (!outcome.ok) {
      const name = outcome.row.student.name || outcome.row.id;
      errors.push(`${name}: ${outcome.message}`);
      continue;
    }
    const fileName = studentCertificatePdfFileName(
      outcome.row.student.name || outcome.generated.studentName,
      usedNames,
    );
    zip.file(fileName, outcome.generated.pdfBytes);
    added += 1;
  }
  return added;
}

/**
 * Atualiza flags automáticas (≥70% presença) antes do ZIP.
 * Não libera alunos abaixo do limiar nem sobrescreve bloqueio manual do professor.
 */
async function prepareCertificateEligibilityForClassGroups(classGroupIds: string[]): Promise<{
  syncedFromAttendance: number;
}> {
  if (classGroupIds.length === 0) {
    return { syncedFromAttendance: 0 };
  }

  const allEnrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      status: certificateZipStatusWhere(),
    },
    select: { id: true },
  });
  const allIds = allEnrollments.map((e) => e.id);
  const { enabledIds } = await syncCertificateEligibleFromAttendance(allIds);

  return { syncedFromAttendance: enabledIds.length };
}

function appendFailuresFile(zip: JSZip, errors: string[], expected: number, added: number) {
  if (errors.length === 0 && added === expected) return;
  const lines = [
    `Aptos (certificateEligible): ${expected}`,
    `Incluídos no ZIP: ${added}`,
    `Falhas: ${errors.length}`,
    "",
  ];
  if (errors.length > 0) {
    lines.push("Detalhes:");
    for (const err of errors) lines.push(`- ${err}`);
  }
  zip.file("falhas.txt", lines.join("\n") + "\n");
}

/** ZIP único com PDFs na raiz (uma turma). */
export async function buildClassGroupCertificatesZip(
  classGroupId: string,
  pages: CertificateZipPages,
): Promise<{ zipBytes: Uint8Array; errors: string[]; fileCount: number; expectedCount: number }> {
  await prepareCertificateEligibilityForClassGroups([classGroupId]);

  const enrollments = await prisma.enrollment.findMany({
    where: classGroupCertificateEnrollmentWhere(classGroupId),
    select: {
      id: true,
      status: true,
      updatedAt: true,
      certificateUrl: true,
      certificateIssuedAt: true,
      student: { select: { name: true } },
    },
    orderBy: { student: { name: "asc" } },
  });

  const zip = new JSZip();
  const errors: string[] = [];
  const sharedCache = new Map<string, SharedCourseCertificateContext>();
  const fileCount = await addEnrollmentCertificatesToZip(
    zip,
    enrollments,
    pages,
    errors,
    sharedCache,
    classGroupId,
  );
  appendFailuresFile(zip, errors, enrollments.length, fileCount);
  const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { zipBytes, errors, fileCount, expectedCount: enrollments.length };
}

/**
 * Um lote do ZIP do ciclo, pequeno o bastante para a resposta da função.
 * `nextOffset` é o índice do próximo aluno apto; quando chega em `total`, acabou.
 */
export async function buildCycleCertificatesZipChunk(
  cycleId: string,
  pages: CertificateZipPages,
  offset: number,
): Promise<{
  zipBytes: Uint8Array;
  errors: string[];
  fileCount: number;
  total: number;
  nextOffset: number;
}> {
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  if (safeOffset === 0) {
    const classGroups = await prisma.classGroup.findMany({
      where: { cycleId, status: { not: "CANCELADA" } },
      select: { id: true },
    });
    await prepareCertificateEligibilityForClassGroups(classGroups.map((cg) => cg.id));
  }

  const where = cycleCertificateEnrollmentWhere(cycleId);
  const total = await prisma.enrollment.count({ where });
  const rows = await prisma.enrollment.findMany({
    where,
    select: {
      id: true,
      classGroupId: true,
      certificateUrl: true,
      certificateIssuedAt: true,
      status: true,
      updatedAt: true,
      student: { select: { name: true } },
      classGroup: { select: { course: { select: { name: true } } } },
    },
    orderBy: [
      { classGroup: { course: { name: "asc" } } },
      { classGroup: { startDate: "asc" } },
      { student: { name: "asc" } },
      { id: "asc" },
    ],
    skip: safeOffset,
    take: CYCLE_CERTIFICATE_ZIP_MAX_FILES + 1,
  });

  const zip = new JSZip();
  const errors: string[] = [];
  const sharedCache = new Map<string, SharedCourseCertificateContext>();
  let includedBytes = 0;
  let fileCount = 0;
  let consumed = 0;

  for (const row of rows) {
    let pdfBytes: Uint8Array;
    try {
      let shared = sharedCache.get(row.classGroupId);
      if (!shared) {
        shared = await loadSharedCourseCertificateContext(row.classGroupId);
        sharedCache.set(row.classGroupId, shared);
      }
      const generated = await generateCertificateForZipRow(row, shared, pages, { compact: true });
      pdfBytes = generated.pdfBytes;
    } catch (e) {
      const name = row.student.name || row.id;
      errors.push(`${name}: ${e instanceof Error ? e.message : "falha"}`);
      consumed += 1;
      continue;
    }

    if (
      !shouldAcceptNextCertificate({
        includedBytes,
        includedCount: fileCount,
        nextBytes: pdfBytes.byteLength,
        maxBytes: CYCLE_CERTIFICATE_ZIP_MAX_BYTES,
        maxCount: CYCLE_CERTIFICATE_ZIP_MAX_FILES,
      })
    ) {
      break;
    }

    const folder = slugPart(row.classGroup.course.name, "curso");
    const fileName = cycleCertificatePdfFileName(row.student.name || "Aluno", row.id);
    zip.file(`${folder}/${fileName}`, pdfBytes);
    includedBytes += pdfBytes.byteLength;
    fileCount += 1;
    consumed += 1;
  }

  if (errors.length > 0) {
    const lines = [
      `Falhas neste lote (a partir do aluno ${safeOffset + 1}):`,
      ...errors.map((err) => `- ${err}`),
      "",
    ];
    zip.file(`falhas-${safeOffset}.txt`, lines.join("\n"));
  }

  const zipBytes =
    fileCount > 0 || errors.length > 0
      ? await zip.generateAsync({
          type: "uint8array",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        })
      : new Uint8Array();

  return {
    zipBytes,
    errors,
    fileCount,
    total,
    nextOffset: Math.min(total, safeOffset + consumed),
  };
}

/** ZIP externo com um ZIP interno por curso (ciclo). */
export async function buildCycleCertificatesZipBundle(
  cycleId: string,
  pages: CertificateZipPages,
): Promise<{ zipBytes: Uint8Array; errors: string[]; fileCount: number; expectedCount: number }> {
  const classGroups = await prisma.classGroup.findMany({
    where: { cycleId, status: { not: "CANCELADA" } },
    select: {
      id: true,
      status: true,
      courseId: true,
      course: { select: { id: true, name: true } },
    },
    orderBy: [{ course: { name: "asc" } }, { startDate: "asc" }],
  });

  const classGroupIds = classGroups.map((cg) => cg.id);
  const prep = await prepareCertificateEligibilityForClassGroups(classGroupIds);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      status: certificateZipStatusWhere(),
    },
    select: {
      id: true,
      classGroupId: true,
      certificateEligible: true,
      certificateUrl: true,
      certificateIssuedAt: true,
      status: true,
      updatedAt: true,
      student: { select: { name: true } },
    },
    orderBy: [{ student: { name: "asc" } }],
  });

  type CourseBucket = {
    courseId: string;
    courseName: string;
    totalEnrollments: number;
    eligibleRows: Array<EnrollmentRow & { classGroupId: string }>;
  };

  const byCourse = new Map<string, CourseBucket>();
  const cgToCourse = new Map(classGroups.map((cg) => [cg.id, cg.course]));

  for (const cg of classGroups) {
    if (!byCourse.has(cg.course.id)) {
      byCourse.set(cg.course.id, {
        courseId: cg.course.id,
        courseName: cg.course.name,
        totalEnrollments: 0,
        eligibleRows: [],
      });
    }
  }

  for (const row of enrollments) {
    const course = cgToCourse.get(row.classGroupId);
    if (!course) continue;
    const bucket = byCourse.get(course.id);
    if (!bucket) continue;
    bucket.totalEnrollments += 1;
    if (row.certificateEligible) {
      bucket.eligibleRows.push(row);
    }
  }

  const outer = new JSZip();
  const errors: string[] = [];
  let fileCount = 0;
  let expectedCount = 0;
  const usedZipNames = new Set<string>();
  const sharedCache = new Map<string, SharedCourseCertificateContext>();
  const summaryLines: string[] = [
    "Certificados por curso neste pacote:",
    `(Liberados automaticamente por frequência ≥70%: ${prep.syncedFromAttendance})`,
    "",
  ];

  for (const [, bucket] of [...byCourse.entries()].sort((a, b) =>
    a[1].courseName.localeCompare(b[1].courseName, "pt-BR"),
  )) {
    const eligibleCount = bucket.eligibleRows.length;
    expectedCount += eligibleCount;
    if (eligibleCount === 0) {
      summaryLines.push(
        `- ${bucket.courseName}: 0 certificado(s) | ${bucket.totalEnrollments} matrícula(s) | nenhum aluno apto (flag Certificado)`,
      );
      continue;
    }

    const inner = new JSZip();
    // Agrupa por turma para reaproveitar o contexto compartilhado.
    const byCg = new Map<string, EnrollmentRow[]>();
    for (const row of bucket.eligibleRows) {
      const list = byCg.get(row.classGroupId) ?? [];
      list.push(row);
      byCg.set(row.classGroupId, list);
    }
    let added = 0;
    for (const [cgId, rows] of byCg) {
      added += await addEnrollmentCertificatesToZip(
        inner,
        rows,
        pages,
        errors,
        sharedCache,
        cgId,
      );
    }
    if (added === 0) {
      summaryLines.push(
        `- ${bucket.courseName}: 0 gerado(s) de ${eligibleCount} apto(s) | ${bucket.totalEnrollments} matrícula(s)`,
      );
      continue;
    }
    fileCount += added;
    const innerBytes = await inner.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const baseSlug = slugPart(bucket.courseName, "curso");
    let innerName = `${baseSlug}.zip`;
    if (usedZipNames.has(innerName)) {
      innerName = `${baseSlug}-${bucket.courseId.slice(0, 8)}.zip`;
    }
    let n = 2;
    while (usedZipNames.has(innerName)) {
      innerName = `${baseSlug}-${bucket.courseId.slice(0, 8)}-${n}.zip`;
      n += 1;
    }
    usedZipNames.add(innerName);
    outer.file(innerName, innerBytes);
    summaryLines.push(
      `- ${bucket.courseName}: ${added} certificado(s) | ${eligibleCount} apto(s) | ${bucket.totalEnrollments} matrícula(s) → ${innerName}`,
    );
  }

  if (errors.length > 0) {
    summaryLines.push("", "Falhas:");
    for (const err of errors.slice(0, 50)) {
      summaryLines.push(`- ${err}`);
    }
    if (errors.length > 50) {
      summaryLines.push(`… e mais ${errors.length - 50} falha(s).`);
    }
  }

  outer.file("resumo-cursos.txt", summaryLines.join("\n") + "\n");

  const zipBytes = await outer.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { zipBytes, errors, fileCount, expectedCount };
}

/** ZIP externo com um ZIP interno por turma (várias turmas selecionadas). */
export async function buildMultiClassGroupCertificatesZipBundle(
  classGroupIds: string[],
  pages: CertificateZipPages,
): Promise<{ zipBytes: Uint8Array; errors: string[]; fileCount: number; expectedCount: number }> {
  const classGroups = await prisma.classGroup.findMany({
    where: { id: { in: classGroupIds }, status: { not: "CANCELADA" } },
    select: {
      id: true,
      course: { select: { name: true } },
      cycle: { select: { cycle: true, year: true } },
    },
    orderBy: [{ course: { name: "asc" } }, { startDate: "asc" }],
  });

  const ids = classGroups.map((cg) => cg.id);
  await prepareCertificateEligibilityForClassGroups(ids);

  const enrollments = await prisma.enrollment.findMany({
    where: classGroupsCertificateEnrollmentWhere(ids),
    select: {
      id: true,
      classGroupId: true,
      certificateUrl: true,
      certificateIssuedAt: true,
      status: true,
      updatedAt: true,
      student: { select: { name: true } },
    },
    orderBy: [{ student: { name: "asc" } }],
  });

  const byCg = new Map<string, EnrollmentRow[]>();
  for (const row of enrollments) {
    const list = byCg.get(row.classGroupId) ?? [];
    list.push(row);
    byCg.set(row.classGroupId, list);
  }

  const outer = new JSZip();
  const errors: string[] = [];
  let fileCount = 0;
  const expectedCount = enrollments.length;
  const usedZipNames = new Set<string>();
  const sharedCache = new Map<string, SharedCourseCertificateContext>();

  for (const cg of classGroups) {
    const rows = byCg.get(cg.id) ?? [];
    if (rows.length === 0) continue;
    const inner = new JSZip();
    const added = await addEnrollmentCertificatesToZip(
      inner,
      rows,
      pages,
      errors,
      sharedCache,
      cg.id,
    );
    if (added === 0) continue;
    fileCount += added;
    const innerBytes = await inner.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const zipLabel = `${slugPart(cg.course.name)}-${cg.cycle.cycle}-${cg.cycle.year}`;
    let innerName = `${zipLabel}.zip`;
    let n = 2;
    while (usedZipNames.has(innerName)) {
      innerName = `${zipLabel}-${n}.zip`;
      n += 1;
    }
    usedZipNames.add(innerName);
    outer.file(innerName, innerBytes);
  }

  const zipBytes = await outer.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { zipBytes, errors, fileCount, expectedCount };
}

export function zipResponse(
  zipBytes: Uint8Array,
  zipName: string,
  errors: string[],
  meta?: { fileCount?: number; expectedCount?: number; nextOffset?: number; total?: number },
): Response {
  return new Response(Buffer.from(zipBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "private, no-store",
      ...(meta?.fileCount != null ? { "X-Certificate-File-Count": String(meta.fileCount) } : {}),
      ...(meta?.expectedCount != null
        ? { "X-Certificate-Expected-Count": String(meta.expectedCount) }
        : {}),
      ...(meta?.nextOffset != null
        ? { "X-Certificate-Next-Offset": String(meta.nextOffset) }
        : {}),
      ...(meta?.total != null ? { "X-Certificate-Total": String(meta.total) } : {}),
      ...(errors.length ? { "X-Certificate-Errors": String(errors.length) } : {}),
    },
  });
}
