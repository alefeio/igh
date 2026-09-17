import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireStaffRead } from "@/lib/auth";
import { buildEnrollmentSlipsPdf, loadEnrollmentSlipData } from "@/lib/enrollment-slip-pdf";
import { jsonErr } from "@/lib/http";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Comprovantes de matrícula em branco para o atendimento presencial.
 * 4 vias por folha A4; `?pages=N` (1–25) já sai com várias folhas.
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireStaffRead();
    const { id: cycleId } = await ctx.params;
    const pagesRaw = Number.parseInt(new URL(request.url).searchParams.get("pages") ?? "1", 10);
    const pages = Number.isFinite(pagesRaw) ? pagesRaw : 1;

    const data = await loadEnrollmentSlipData(cycleId);
    if (data.courses.length === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        "Este ciclo não tem turmas ativas, então não há cursos para listar no comprovante.",
        400,
      );
    }

    const bytes = Uint8Array.from(await buildEnrollmentSlipsPdf(data, { pages }));
    const fileName = `comprovantes-matricula-ciclo-${data.cycle.cycle}-${data.cycle.year}.pdf`;

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao gerar os comprovantes.";
    if (msg === "Ciclo não encontrado.") {
      return jsonErr("NOT_FOUND", msg, 404);
    }
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
