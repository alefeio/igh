import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { jsonErr, jsonOk } from "@/lib/http";
import { parseTeacherEvaluationListFilter } from "@/lib/teacher-class-evaluation";
import { listTeacherClassEvaluations } from "@/lib/teacher-class-evaluation-query";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    await requireCoordenacaoViewer();
    const params = new URL(request.url).searchParams;
    const filter = parseTeacherEvaluationListFilter(params);
    const page = Math.max(1, Number(params.get("page") || "1") || 1);
    const pageSizeRaw = Number(params.get("pageSize") || String(DEFAULT_PAGE_SIZE));
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE));
    const result = await listTeacherClassEvaluations(undefined, {
      revealIdentity: true,
      includeAnonymous: true,
      filter,
      page,
      pageSize,
    });
    return jsonOk(result);
  } catch (e) {
    const auth = coordenacaoAuthResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar as avaliações.", 500);
  }
}
