import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  buildCycleClassGroupsReport,
  buildCycleClassGroupsReportPdf,
  buildCycleClassGroupsReportXlsx,
} from "@/lib/cycle-class-groups-report";
import { jsonErr } from "@/lib/http";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Relatório do ciclo em Excel ou PDF (?format=xlsx|pdf).
 * Excel: abas Turmas + Por curso + Glossário.
 * PDF: resumo por curso + detalhe das turmas (paisagem).
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["ADMIN", "MASTER"]);
    const { id: cycleId } = await ctx.params;
    const url = new URL(request.url);
    const formatRaw = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
    const format = formatRaw === "pdf" ? "pdf" : "xlsx";

    const report = await buildCycleClassGroupsReport(cycleId);
    if (report.turmaRows.length === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        "Não há turmas neste ciclo para o relatório (exceto canceladas).",
        400,
      );
    }

    if (format === "pdf") {
      const buffer = await buildCycleClassGroupsReportPdf(report);
      const fileName = `relatorio-ciclo-${report.cycle.cycle}-${report.cycle.year}.pdf`;
      const outBytes = Uint8Array.from(buffer);
      return new Response(outBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
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
