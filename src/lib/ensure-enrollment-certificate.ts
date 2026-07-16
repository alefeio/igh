import "server-only";

import { resolveCertificateIssuedAt } from "@/lib/course-certificate-eligibility";
import {
  generateAndUploadCourseCompletionCertificate,
  generateCourseCompletionCertificatePdfBytes,
} from "@/lib/course-completion-certificate";
import type { CertificateZipPages } from "@/lib/course-certificate-pdf-naming";
import { studentCertificatePdfFileName } from "@/lib/course-certificate-pdf-naming";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";

function safePdfFileName(studentName: string): string {
  const used = new Set<string>();
  return studentCertificatePdfFileName(studentName, used);
}

async function loadEnrollmentCertificateContext(enrollmentId: string) {
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

  if (!enrollment.certificateEligible) {
    throw new Error("Matrícula não está apta a receber certificado.");
  }

  const studentName =
    enrollment.student.name?.trim() || enrollment.student.user?.name?.trim() || "Aluno";
  const modules = await getModulesWithLessonsByCourseId(enrollment.classGroup.course.id);
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
    moduleTitles: modules.map((m) => m.title),
    teacherName: enrollment.classGroup.teacher.name,
    teacherSignatureUrl: enrollment.classGroup.teacher.signatureUrl,
    issuedAt,
  };

  return { enrollment, studentName, input };
}

/**
 * Garante certificado da matrícula (frente+verso): reutiliza cache se existir, senão gera e grava.
 * Para ZIP com só a frente, use `generateEnrollmentCertificatePdf` com `pages: "front"`.
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
  const { enrollment, studentName, input } = await loadEnrollmentCertificateContext(enrollmentId);

  if (!options?.force && enrollment.certificateUrl) {
    try {
      const res = await fetch(enrollment.certificateUrl, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        return {
          pdfBytes: buf,
          url: enrollment.certificateUrl,
          fileName: enrollment.certificateFileName || safePdfFileName(studentName),
          publicId: enrollment.certificatePublicId,
          studentName,
          cached: true,
        };
      }
    } catch {
      // regenera abaixo
    }
  }

  const uploaded = await generateAndUploadCourseCompletionCertificate({
    enrollmentId: enrollment.id,
    input,
    pages: "both",
  });

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      certificateUrl: uploaded.url,
      certificatePublicId: uploaded.publicId,
      certificateFileName: uploaded.fileName,
      certificateIssuedAt: enrollment.certificateIssuedAt ?? input.issuedAt,
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

/**
 * Gera bytes do certificado sem alterar o cache da matrícula.
 * Use `pages: "front"` nos downloads em lote só da frente.
 */
export async function generateEnrollmentCertificatePdf(
  enrollmentId: string,
  options?: { pages?: CertificateZipPages },
): Promise<{
  pdfBytes: Uint8Array;
  fileName: string;
  studentName: string;
}> {
  const { studentName, input } = await loadEnrollmentCertificateContext(enrollmentId);
  const pages = options?.pages === "front" ? "front" : "both";
  const pdfBytes = await generateCourseCompletionCertificatePdfBytes(input, { pages });
  return {
    pdfBytes,
    fileName: safePdfFileName(studentName),
    studentName,
  };
}

/** Gera bytes sem upload (útil se Apimages falhar em lote) — raramente usado. */
export async function generateEnrollmentCertificateBytesOnly(enrollmentId: string): Promise<{
  pdfBytes: Uint8Array;
  fileName: string;
  studentName: string;
}> {
  return generateEnrollmentCertificatePdf(enrollmentId, { pages: "both" });
}
