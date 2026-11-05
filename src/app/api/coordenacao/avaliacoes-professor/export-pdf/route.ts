import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { jsonErr } from "@/lib/http";
import { buildTeacherEvaluationExportPdf } from "@/lib/teacher-class-evaluation-export";
import { parseTeacherEvaluationListFilter } from "@/lib/teacher-class-evaluation";
import { loadCoordinatorTeacherEvaluationExport } from "@/lib/teacher-class-evaluation-query";
import { describeTeacherEvaluationFilter } from "@/lib/teacher-class-evaluation-filter-label";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireCoordenacaoViewer();
    const filter = parseTeacherEvaluationListFilter(new URL(request.url).searchParams);
    const { ranking, evaluations } = await loadCoordinatorTeacherEvaluationExport(filter);
    const pdfBytes = await buildTeacherEvaluationExportPdf({
      filterLabel: await describeTeacherEvaluationFilter(filter),
      ranking,
      evaluations,
    });
    const filename = `experiencia-professores-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const auth = coordenacaoAuthResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível exportar o PDF.", 500);
  }
}
