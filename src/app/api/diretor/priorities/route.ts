import { requireDirectorRead } from "@/lib/diretor/auth";
import { alertsFromExecutiveFacts } from "@/lib/diretor/alerts/engine";
import { mapSettledLimit } from "@/lib/diretor/concurrency";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademicExecutiveFacts } from "@/lib/diretor/facts/academic";
import { loadAdministrativeExecutiveFacts } from "@/lib/diretor/facts/administrative";
import { loadFinancialExecutiveFacts } from "@/lib/diretor/facts/financial";
import { loadOfferExecutiveFacts } from "@/lib/diretor/facts/offer";
import { loadProjectExecutiveFacts } from "@/lib/diretor/facts/projects";
import { loadSocialExecutiveFacts } from "@/lib/diretor/facts/social";
import { defaultCompetence } from "@/lib/diretor/period";
import { parseSearchParams, prioritiesQuerySchema } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";
import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import type {
  AcademicExecutiveFacts,
  AdministrativeExecutiveFacts,
  FinancialExecutiveFacts,
  OfferExecutiveFacts,
  ProjectExecutiveFacts,
  SocialExecutiveFacts,
} from "@/lib/diretor/facts/types";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(prioritiesQuerySchema, url);
    const scope = await resolveDirectorScope({ scope: q.scope, cycleId: q.cycleId });
    const competence = q.execCompetence ?? defaultCompetence(scope.dataAsOf);
    const asOf = scope.dataAsOf;

    const settled = await mapSettledLimit(
      [
        { label: "academic", run: () => loadAcademicExecutiveFacts(scope, viewer) },
        { label: "offer", run: () => loadOfferExecutiveFacts(scope, viewer) },
        { label: "financial", run: () => loadFinancialExecutiveFacts({ competence }, viewer, asOf) },
        { label: "social", run: () => loadSocialExecutiveFacts(viewer, asOf) },
        { label: "administrative", run: () => loadAdministrativeExecutiveFacts(viewer, asOf) },
        { label: "projects", run: () => loadProjectExecutiveFacts(viewer) },
      ],
      2,
    );
    const by = Object.fromEntries(settled.map((s) => [s.label, s]));

    let alerts = alertsFromExecutiveFacts({
      academic: by.academic?.ok ? (by.academic.value as AcademicExecutiveFacts) : undefined,
      offer: by.offer?.ok ? (by.offer.value as OfferExecutiveFacts) : undefined,
      financial: by.financial?.ok ? (by.financial.value as FinancialExecutiveFacts) : undefined,
      social: by.social?.ok ? (by.social.value as SocialExecutiveFacts) : undefined,
      administrative: by.administrative?.ok ? (by.administrative.value as AdministrativeExecutiveFacts) : undefined,
      projects: by.projects?.ok ? (by.projects.value as ProjectExecutiveFacts) : undefined,
    });
    const structural = alerts.filter((a) => a.id === "proj-unavailable");
    alerts = alerts.filter((a) => a.id !== "proj-unavailable");
    if (q.severity !== "all") alerts = alerts.filter((a) => a.severity === q.severity);
    if (q.domain !== "all") alerts = alerts.filter((a) => a.domain === q.domain);

    return jsonOk({
      meta: {
        generatedAt: new Date().toISOString(),
        dataAsOf: scope.dataAsOf.toISOString(),
        filters: {
          scope: q.scope,
          cycleId: scope.cycleId,
          severity: q.severity,
          domain: q.domain,
          execCompetence: competence,
        },
        quality: [{ domain: "overview", status: "ok" as const }],
        formulaVersion: FORMULA_VERSION_1C,
        viewer,
      },
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      alerts,
      qualityNotes: [
        ...settled.filter((s) => !s.ok).map((s) => s.error),
        ...structural.map((a) => a.fact),
      ],
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
