import "server-only";

import { resolveCertificateIssuedAt } from "@/lib/course-certificate-eligibility";
import {
  generateAndUploadCourseCompletionCertificate,
  generateCourseCompletionCertificatePdfBytes,
} from "@/lib/course-completion-certificate";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";

function safePdfFileName(studentName: string, enrollmentId: string): string {
  const slug = (studentName || "aluno")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 50);
  return `certificado-${slug || "aluno"}-${enrollmentId.slice(0, 8)}.pdf`;
}

/**
 * Garante certificado da matrícula: reutiliza cache se existir, senão gera e grava.
 * Retorna bytes do PDF e metadados.
 */
export async function ensureEnrollmentCertificate(
  enrollmentId: string,
  options?: { force?: boolean },
): Promise<{
  pdfBytes: Uint8Array;
  url: string;
  fileName: string;
  publicId: string | null;
  studentName: string;
  cached: boolean;
}> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: { select: { name: true, user: { select: { name: true } } } },
      classGroup: {
        include: {
          course: { select: { id: true, name: true, workloadHours: true } },
          teacher: { select: { name: true, signatureUrl: true } },
        },
      },
    },
  });

  if (!enrollment) {
    throw new Error("Matrícula não encontrada.");
  }

  const studentName =
    enrollment.student.name?.trim() || enrollment.student.user?.name?.trim() || "Aluno";

  if (!options?.force && enrollment.certificateUrl) {
    try {
      const res = await fetch(enrollment.certificateUrl, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        return {
          pdfBytes: buf,
          url: enrollment.certificateUrl,
          fileName: enrollment.certificateFileName || safePdfFileName(studentName, enrollment.id),
          publicId: enrollment.certificatePublicId,
          studentName,
          cached: true,
        };
      }
    } catch {
      // regenera abaixo
    }
  }

  const modules = await getModulesWithLessonsByCourseId(enrollment.classGroup.course.id);
  const moduleTitles = modules.map((m) => m.title);
  const issuedAt = resolveCertificateIssuedAt({
    certificateIssuedAt: enrollment.certificateIssuedAt,
    status: enrollment.status,
    updatedAt: enrollment.updatedAt,
    classGroupEndDate: enrollment.classGroup.endDate,
  });

  const input = {
    studentName,
    courseName: enrollment.classGroup.course.name,
    workloadHours: enrollment.classGroup.course.workloadHours,
    moduleTitles,
    teacherName: enrollment.classGroup.teacher.name,
    teacherSignatureUrl: enrollment.classGroup.teacher.signatureUrl,
    issuedAt,
  };

  const uploaded = await generateAndUploadCourseCompletionCertificate({
    enrollmentId: enrollment.id,
    input,
  });

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      certificateUrl: uploaded.url,
      certificatePublicId: uploaded.publicId,
      certificateFileName: uploaded.fileName,
      certificateIssuedAt: enrollment.certificateIssuedAt ?? issuedAt,
    },
  });

  return {
    pdfBytes: uploaded.pdfBytes,
    url: uploaded.url,
    fileName: uploaded.fileName,
    publicId: uploaded.publicId,
    studentName,
    cached: false,
  };
}

/** Gera bytes sem upload (útil se Apimages falhar em lote) — raramente usado. */
export async function generateEnrollmentCertificateBytesOnly(enrollmentId: string): Promise<{
  pdfBytes: Uint8Array;
  fileName: string;
  studentName: string;
}> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: { select: { name: true, user: { select: { name: true } } } },
      classGroup: {
        include: {
          course: { select: { id: true, name: true, workloadHours: true } },
          teacher: { select: { name: true, signatureUrl: true } },
        },
      },
    },
  });
  if (!enrollment) throw new Error("Matrícula não encontrada.");

  const studentName =
    enrollment.student.name?.trim() || enrollment.student.user?.name?.trim() || "Aluno";
  const modules = await getModulesWithLessonsByCourseId(enrollment.classGroup.course.id);
  const issuedAt = resolveCertificateIssuedAt({
    certificateIssuedAt: enrollment.certificateIssuedAt,
    status: enrollment.status,
    updatedAt: enrollment.updatedAt,
    classGroupEndDate: enrollment.classGroup.endDate,
  });

  const pdfBytes = await generateCourseCompletionCertificatePdfBytes({
    studentName,
    courseName: enrollment.classGroup.course.name,
    workloadHours: enrollment.classGroup.course.workloadHours,
    moduleTitles: modules.map((m) => m.title),
    teacherName: enrollment.classGroup.teacher.name,
    teacherSignatureUrl: enrollment.classGroup.teacher.signatureUrl,
    issuedAt,
  });

  return {
    pdfBytes,
    fileName: safePdfFileName(studentName, enrollment.id),
    studentName,
  };
}
