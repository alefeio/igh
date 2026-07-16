import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  buildCycleCertificatesZipBundle,
  parseCertificateZipPages,
  zipResponse,
} from "@/lib/course-certificates-zip";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * ZIP externo com um arquivo .zip por curso (turmas do mesmo curso agrupadas).
 * Query: pages=front | both (padrão both).
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
    const { id: cycleId } = await ctx.params;
    const pages = parseCertificateZipPages(new URL(request.url).searchParams.get("pages"));

    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, cycle: true, year: true },
    });
    if (!cycle) return jsonErr("NOT_FOUND", "Ciclo não encontrado.", 404);

    const { zipBytes, errors, fileCount } = await buildCycleCertificatesZipBundle(cycleId, pages);

    if (fileCount === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        errors.length
          ? `Nenhum certificado gerado. ${errors.slice(0, 3).join("; ")}`
          : "Não há alunos aptos a certificado nas turmas deste ciclo.",
        400,
      );
    }

    const zipName = `certificados-ciclo-${cycle.cycle}-${cycle.year}.zip`;
    return zipResponse(zipBytes, zipName, errors);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao montar o ZIP do ciclo.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
