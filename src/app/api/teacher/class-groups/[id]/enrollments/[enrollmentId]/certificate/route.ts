import { authErrorResponse } from "@/lib/api-auth-guard";
import { ensureEnrollmentCertificate } from "@/lib/ensure-enrollment-certificate";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

/**
 * Gera (se necessário) e devolve o PDF do certificado de um aluno da turma.
 * Disponível quando Certificado = Sim (mesma regra do ZIP em lote).
 * Query: download=1 (padrão) devolve o PDF; download=0 devolve JSON com url.
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const { id: classGroupId, enrollmentId } = await context.params;
    const access = await requireReadableClassGroup(classGroupId);
    if ("error" in access) return access.error;
    const { searchParams } = new URL(request.url);
    const forceDownload = searchParams.get("download") !== "0";

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
