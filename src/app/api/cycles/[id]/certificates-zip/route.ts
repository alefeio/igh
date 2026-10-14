import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  buildCycleCertificatesZipChunk,
  parseCertificateZipPages,
  zipResponse,
} from "@/lib/course-certificates-zip";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Um lote do ZIP do ciclo (cabe no limite de resposta).
 * Query: pages=front | both (padrão both), offset=índice do próximo aluno apto.
 * Cabeçalhos: X-Certificate-Next-Offset e X-Certificate-Total.
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["ADMIN", "MASTER"]);
    const { id: cycleId } = await ctx.params;
    const url = new URL(request.url);
    const pages = parseCertificateZipPages(url.searchParams.get("pages"));
    const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;

    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, cycle: true, year: true },
    });
    if (!cycle) return jsonErr("NOT_FOUND", "Ciclo não encontrado.", 404);

    const { zipBytes, errors, fileCount, total, nextOffset } = await buildCycleCertificatesZipChunk(
      cycleId,
      pages,
      offset,
    );

    if (fileCount === 0 && zipBytes.byteLength === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        errors.length
          ? `Nenhum certificado gerado. ${errors.slice(0, 3).join("; ")}`
          : "Não há alunos aptos a certificado nas turmas deste ciclo.",
        400,
      );
    }

    const multi = offset > 0 || nextOffset < total;
    const zipName = multi
      ? `certificados-ciclo-${cycle.cycle}-${cycle.year}-lote-${offset}.zip`
      : `certificados-ciclo-${cycle.cycle}-${cycle.year}.zip`;
    return zipResponse(zipBytes, zipName, errors, {
      fileCount,
      expectedCount: total,
      nextOffset,
      total,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao montar o ZIP do ciclo.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
