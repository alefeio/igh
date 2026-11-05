import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { jsonErr } from "@/lib/http";
import { buildTeacherEvaluationExportCsv } from "@/lib/teacher-class-evaluation-export";
import { parseTeacherEvaluationListFilter } from "@/lib/teacher-class-evaluation";
import { loadCoordinatorTeacherEvaluationExport } from "@/lib/teacher-class-evaluation-query";
import { describeTeacherEvaluationFilter } from "@/lib/teacher-class-evaluation-filter-label";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireCoordenacaoViewer();
    const filter = parseTeacherEvaluationListFilter(new URL(request.url).searchParams);
    const { ranking, evaluations } = await loadCoordinatorTeacherEvaluationExport(filter);
    const csv = buildTeacherEvaluationExportCsv({
      filterLabel: await describeTeacherEvaluationFilter(filter),
      ranking,
      evaluations,
    });
    const filename = `experiencia-professores-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const auth = coordenacaoAuthResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível exportar o CSV.", 500);
  }
}
