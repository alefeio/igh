import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { getCourseCertificateEligibility } from "@/lib/course-certificate-eligibility";
import { ensureEnrollmentCertificate } from "@/lib/ensure-enrollment-certificate";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { STUDENT_VISIBLE_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";

type RouteCtx = { params: Promise<{ enrollmentId: string }> };

/**
 * Gera (se necessário) e devolve o certificado de conclusão do curso.
 * Disponível quando a turma está ENCERRADA.
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole("STUDENT");
    const { enrollmentId } = await ctx.params;
    const { searchParams } = new URL(request.url);
    const forceDownload = searchParams.get("download") === "1";

    const student = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        studentId: student.id,
        status: { in: [...STUDENT_VISIBLE_ENROLLMENT_STATUSES] },
      },
      select: { id: true, certificateUrl: true, certificateFileName: true },
    });

    if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

    const eligibility = await getCourseCertificateEligibility(enrollmentId);
    if (!eligibility.eligible) {
      return jsonErr("FORBIDDEN", eligibility.reason ?? "Certificado ainda não disponível.", 403);
    }

    // force: aplica regras atuais (fonte em 1 linha, mínimo 40h)
    const ensured = await ensureEnrollmentCertificate(enrollmentId, { force: true });

    if (forceDownload) {
      return new Response(Buffer.from(ensured.pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${ensured.fileName}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    return jsonOk({
      url: ensured.url,
      fileName: ensured.fileName,
      cached: ensured.cached,
      eligibility,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao gerar certificado.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
