import "server-only";

import JSZip from "jszip";

import {
  parseCertificateZipPages,
  studentCertificatePdfFileName,
  slugPart,
  type CertificateZipPages,
} from "@/lib/course-certificate-pdf-naming";
import { syncCertificateEligibleFromAttendance } from "@/lib/enrollment-certificate-eligibility-sync";
import { generateEnrollmentCertificatePdf } from "@/lib/ensure-enrollment-certificate";
import { prisma } from "@/lib/prisma";

export type { CertificateZipPages };
export { parseCertificateZipPages, slugPart, studentCertificatePdfFileName };

type EnrollmentRow = { id: string; student: { name: string } };

const ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED", "SUSPENDED"] as const;

export async function addEnrollmentCertificatesToZip(
  zip: JSZip,
  enrollments: EnrollmentRow[],
  pages: CertificateZipPages,
  errors: string[],
): Promise<number> {
  const usedNames = new Set<string>();
  let added = 0;
  for (const row of enrollments) {
    try {
      const generated = await generateEnrollmentCertificatePdf(row.id, { pages });
      const fileName = studentCertificatePdfFileName(
        row.student.name || generated.studentName,
        usedNames,
      );
      zip.file(fileName, generated.pdfBytes);
      added += 1;
    } catch (e) {
      const name = row.student.name || row.id;
      errors.push(`${name}: ${e instanceof Error ? e.message : "falha"}`);
    }
  }
  return added;
}

/**
 * Atualiza flags automáticas (≥70% presença) e, em turmas ENCERRADAS, libera
 * quem ainda não foi bloqueado manualmente pelo professor — backfill para ciclos
 * encerrados antes da feature da flag.
 */
async function prepareCertificateEligibilityForClassGroups(classGroupIds: string[]): Promise<{
  syncedFromAttendance: number;
  backfilledEncerrada: number;
}> {
  if (classGroupIds.length === 0) {
    return { syncedFromAttendance: 0, backfilledEncerrada: 0 };
  }

  const allEnrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      status: { in: [...ENROLLMENT_STATUSES] },
      isPreEnrollment: false,
    },
    select: { id: true },
  });
  const allIds = allEnrollments.map((e) => e.id);
  const { enabledIds } = await syncCertificateEligibleFromAttendance(allIds);

  const encerradaGroups = await prisma.classGroup.findMany({
    where: { id: { in: classGroupIds }, status: "ENCERRADA" },
    select: { id: true },
  });
  const encerradaIds = encerradaGroups.map((g) => g.id);

  let backfilledEncerrada = 0;
  if (encerradaIds.length > 0) {
    const result = await prisma.enrollment.updateMany({
      where: {
        classGroupId: { in: encerradaIds },
        status: { in: [...ENROLLMENT_STATUSES] },
        isPreEnrollment: false,
        certificateEligible: false,
        certificateEligibleManual: false,
      },
      data: { certificateEligible: true },
    });
    backfilledEncerrada = result.count;
  }

  return {
    syncedFromAttendance: enabledIds.length,
    backfilledEncerrada,
  };
}

/** ZIP único com PDFs na raiz (uma turma). */
export async function buildClassGroupCertificatesZip(
  classGroupId: string,
  pages: CertificateZipPages,
): Promise<{ zipBytes: Uint8Array; errors: string[]; fileCount: number }> {
  await prepareCertificateEligibilityForClassGroups([classGroupId]);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId,
      status: { in: [...ENROLLMENT_STATUSES] },
      isPreEnrollment: false,
      certificateEligible: true,
    },
    select: { id: true, student: { select: { name: true } } },
    orderBy: { student: { name: "asc" } },
  });

  const zip = new JSZip();
  const errors: string[] = [];
  const fileCount = await addEnrollmentCertificatesToZip(zip, enrollments, pages, errors);
  const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { zipBytes, errors, fileCount };
}

/** ZIP externo com um ZIP interno por curso (ciclo). */
export async function buildCycleCertificatesZipBundle(
  cycleId: string,
  pages: CertificateZipPages,
): Promise<{ zipBytes: Uint8Array; errors: string[]; fileCount: number }> {
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
      status: { in: [...ENROLLMENT_STATUSES] },
      isPreEnrollment: false,
    },
    select: {
      id: true,
      classGroupId: true,
      certificateEligible: true,
      student: { select: { name: true } },
    },
    orderBy: [{ student: { name: "asc" } }],
  });

  type CourseBucket = {
    courseId: string;
    courseName: string;
    totalEnrollments: number;
    eligibleRows: EnrollmentRow[];
  };

  const byCourse = new Map<string, CourseBucket>();
  const cgToCourse = new Map(classGroups.map((cg) => [cg.id, cg.course]));

  // Garante uma entrada por curso presente no ciclo (mesmo sem aptos).
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
      bucket.eligibleRows.push({ id: row.id, student: row.student });
    }
  }

  const outer = new JSZip();
  const errors: string[] = [];
  let fileCount = 0;
  const usedZipNames = new Set<string>();
  const summaryLines: string[] = [
    "Certificados por curso neste pacote:",
    `(Auto ≥70% presença: ${prep.syncedFromAttendance} liberado(s); turmas ENCERRADAS sem bloqueio manual: ${prep.backfilledEncerrada} liberado(s))`,
    "",
  ];

  for (const [, bucket] of [...byCourse.entries()].sort((a, b) =>
    a[1].courseName.localeCompare(b[1].courseName, "pt-BR"),
  )) {
    const eligibleCount = bucket.eligibleRows.length;
    if (eligibleCount === 0) {
      summaryLines.push(
        `- ${bucket.courseName}: 0 certificado(s) | ${bucket.totalEnrollments} matrícula(s) | nenhum aluno apto (flag Certificado)`,
      );
      continue;
    }

    const inner = new JSZip();
    const added = await addEnrollmentCertificatesToZip(inner, bucket.eligibleRows, pages, errors);
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
  return { zipBytes, errors, fileCount };
}

/** ZIP externo com um ZIP interno por turma (várias turmas selecionadas). */
export async function buildMultiClassGroupCertificatesZipBundle(
  classGroupIds: string[],
  pages: CertificateZipPages,
): Promise<{ zipBytes: Uint8Array; errors: string[]; fileCount: number }> {
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
    where: {
      classGroupId: { in: ids },
      status: { in: [...ENROLLMENT_STATUSES] },
      isPreEnrollment: false,
      certificateEligible: true,
    },
    select: {
      id: true,
      classGroupId: true,
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
  const usedZipNames = new Set<string>();

  for (const cg of classGroups) {
    const rows = byCg.get(cg.id) ?? [];
    if (rows.length === 0) continue;
    const inner = new JSZip();
    const added = await addEnrollmentCertificatesToZip(inner, rows, pages, errors);
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
  return { zipBytes, errors, fileCount };
}

export function zipResponse(zipBytes: Uint8Array, zipName: string, errors: string[]): Response {
  return new Response(Buffer.from(zipBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "private, no-store",
      ...(errors.length ? { "X-Certificate-Errors": String(errors.length) } : {}),
    },
  });
}
