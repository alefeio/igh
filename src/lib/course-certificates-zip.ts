import "server-only";

import JSZip from "jszip";

import {
  parseCertificateZipPages,
  studentCertificatePdfFileName,
  slugPart,
  type CertificateZipPages,
} from "@/lib/course-certificate-pdf-naming";
import { generateEnrollmentCertificatePdf } from "@/lib/ensure-enrollment-certificate";
import { prisma } from "@/lib/prisma";

export type { CertificateZipPages };
export { parseCertificateZipPages, slugPart, studentCertificatePdfFileName };

type EnrollmentRow = { id: string; student: { name: string } };

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

/** ZIP único com PDFs na raiz (uma turma). */
export async function buildClassGroupCertificatesZip(
  classGroupId: string,
  pages: CertificateZipPages,
): Promise<{ zipBytes: Uint8Array; errors: string[]; fileCount: number }> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId,
      status: { in: ["ACTIVE", "COMPLETED", "SUSPENDED"] },
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
      courseId: true,
      course: { select: { id: true, name: true } },
    },
    orderBy: [{ course: { name: "asc" } }, { startDate: "asc" }],
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId: { in: classGroups.map((cg) => cg.id) },
      status: { in: ["ACTIVE", "COMPLETED", "SUSPENDED"] },
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

  const byCourse = new Map<string, { courseName: string; rows: EnrollmentRow[] }>();
  const cgToCourse = new Map(classGroups.map((cg) => [cg.id, cg.course]));

  for (const row of enrollments) {
    const course = cgToCourse.get(row.classGroupId);
    if (!course) continue;
    const bucket = byCourse.get(course.id) ?? { courseName: course.name, rows: [] };
    bucket.rows.push(row);
    byCourse.set(course.id, bucket);
  }

  const outer = new JSZip();
  const errors: string[] = [];
  let fileCount = 0;

  for (const [, bucket] of [...byCourse.entries()].sort((a, b) =>
    a[1].courseName.localeCompare(b[1].courseName, "pt-BR"),
  )) {
    const inner = new JSZip();
    const added = await addEnrollmentCertificatesToZip(inner, bucket.rows, pages, errors);
    if (added === 0) continue;
    fileCount += added;
    const innerBytes = await inner.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const innerName = `${slugPart(bucket.courseName, "curso")}.zip`;
    outer.file(innerName, innerBytes);
  }

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

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId: { in: classGroups.map((cg) => cg.id) },
      status: { in: ["ACTIVE", "COMPLETED", "SUSPENDED"] },
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
