import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { ensureEnrollmentCertificate } from "@/lib/ensure-enrollment-certificate";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

/**
 * Gera (se necessário) e devolve o PDF do certificado de um aluno da turma.
 * Disponível quando Certificado = Sim (mesma regra do ZIP em lote).
 * Query: download=1 (padrão) devolve o PDF; download=0 devolve JSON com url.
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireRole(["TEACHER"]);
    const { id: classGroupId, enrollmentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const forceDownload = searchParams.get("download") !== "0";

    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

    const cg = await prisma.classGroup.findFirst({
      where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
      select: { id: true },
    });
    if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        classGroupId,
        status: { in: ["ACTIVE", "SUSPENDED", "COMPLETED"] },
      },
      select: {
        id: true,
        certificateEligible: true,
      },
    });
    if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada nesta turma.", 404);

    if (!enrollment.certificateEligible) {
      return jsonErr(
        "FORBIDDEN",
        "Esta matrícula não está apta a receber certificado. Marque Certificado = Sim.",
        403,
      );
    }

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
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao gerar certificado.";
    if (msg === "Matrícula não está apta a receber certificado.") {
      return jsonErr("FORBIDDEN", msg, 403);
    }
    if (msg === "Matrícula não encontrada.") {
      return jsonErr("NOT_FOUND", msg, 404);
    }
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
