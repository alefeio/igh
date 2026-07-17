import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  buildCycleClassGroupsReport,
  buildCycleClassGroupsReportXlsx,
} from "@/lib/cycle-class-groups-report";
import { jsonErr } from "@/lib/http";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Relatório Excel do ciclo: aba Turmas + aba Por curso + Glossário.
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
    const { id: cycleId } = await ctx.params;

    const report = await buildCycleClassGroupsReport(cycleId);
    if (report.turmaRows.length === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        "Não há turmas neste ciclo para o relatório (exceto canceladas).",
        400,
      );
    }

    const buffer = await buildCycleClassGroupsReportXlsx(report);
    const fileName = `relatorio-ciclo-${report.cycle.cycle}-${report.cycle.year}.xlsx`;
    const outBytes = Uint8Array.from(buffer);

    return new Response(outBytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao gerar o relatório.";
    if (msg === "Ciclo não encontrado.") {
      return jsonErr("NOT_FOUND", msg, 404);
    }
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
