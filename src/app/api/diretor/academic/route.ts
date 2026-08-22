import { requireDirectorRead } from "@/lib/diretor/auth";
import { getMetricDefinition } from "@/lib/diretor/catalog/definitions";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademic } from "@/lib/diretor/metrics/academic";
import { academicQuerySchema, parseSearchParams } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(academicQuerySchema, url);
    const scope = await resolveDirectorScope({ scope: q.scope, cycleId: q.cycleId });
    const bundle = await loadAcademic(
      scope,
      { courseId: q.courseId, classGroupId: q.classGroupId, poloId: q.poloId },
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
    return directorApiError(e);
  }
}

export function POST() {
  return methodNotAllowed();
}
export function PATCH() {
  return methodNotAllowed();
}
export function DELETE() {
  return methodNotAllowed();
}
