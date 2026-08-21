import { requireDirectorRead } from "@/lib/diretor/auth";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademicOfferBundle } from "@/lib/diretor/metrics/academic-offer";
import { academicQuerySchema, parseSearchParams } from "@/lib/diretor/search-params";
import { getMetricDefinition } from "@/lib/diretor/catalog/definitions";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(academicQuerySchema, url);
    const scope = await resolveDirectorScope({
      scope: q.scope,
      cycleId: q.cycleId,
    });
    const bundle = await loadAcademicOfferBundle(
      scope,
      {
        courseId: q.courseId,
        classGroupId: q.classGroupId,
        poloId: q.poloId,
      },
      viewer,
    );

    return jsonOk({
      meta: bundle.meta,
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      academic: bundle.academic,
      metrics: {
        present: getMetricDefinition("acad.attendance.present_rate"),
        justified: getMetricDefinition("acad.attendance.justified_rate"),
        unjustified: getMetricDefinition("acad.attendance.unjustified_rate"),
        criticalAbsences: getMetricDefinition("acad.attrition.risk.critical_absences"),
        completion: getMetricDefinition("acad.completion.started_rate"),
        cancelUntyped: getMetricDefinition("acad.cancel.after_start_untyped"),
        served: getMetricDefinition("ben.served_unique"),
      },
      qualityNotes: bundle.qualityNotes,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Acesso restrito ao perfil Diretor (ou preview Master).", 403);
    }
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    }
    console.error("[diretor/academic]", e);
    return jsonErr("INTERNAL", "Falha ao montar acadêmico.", 500);
  }
}
