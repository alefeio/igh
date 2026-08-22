import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { loadFinancial } from "@/lib/diretor/metrics/financial";
import { financialQuerySchema, parseSearchParams } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(financialQuerySchema, url);
    const bundle = await loadFinancial(q, viewer);
    return jsonOk({
      meta: bundle.meta,
      disclaimer: bundle.disclaimer,
      kpis: bundle.kpis,
      movement: bundle.movement,
      apAr: bundle.apAr,
      byCategory: bundle.byCategory,
      byNature: bundle.byNature,
      byPolo: bundle.byPolo,
      monthlyPaid: bundle.monthlyPaid,
      payroll: bundle.payroll,
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
