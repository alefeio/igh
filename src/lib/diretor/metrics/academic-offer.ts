import "server-only";

import { FORMULA_VERSION_1A } from "@/lib/diretor/catalog/definitions";
import { loadAcademic } from "@/lib/diretor/metrics/academic";
import { loadOffer } from "@/lib/diretor/metrics/offer";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import type { AcademicOfferBundle } from "@/lib/diretor/metrics/academic-offer-types";

export type { AcademicOfferBundle };

/**
 * Composição explícita (não usada pelas APIs 1B). Mantida para benchmark vs legado.
 * Acadêmico e Oferta continuam loaders independentes.
 */
export async function loadAcademicOfferBundle(
  scope: ScopeResolution,
  filters: { courseId?: string; classGroupId?: string; poloId?: string },
  viewer: "DIRECTOR" | "MASTER",
): Promise<AcademicOfferBundle> {
  const [academic, offer] = await Promise.all([
    loadAcademic(scope, filters, viewer),
    loadOffer(scope, { courseId: filters.courseId, poloId: filters.poloId }, viewer),
  ]);
  return {
    meta: {
      ...academic.meta,
      quality: [...academic.meta.quality, ...offer.meta.quality],
      formulaVersion: FORMULA_VERSION_1A,
    },
    kpis: [...academic.kpis, ...offer.kpis].slice(0, 6),
    academic: academic.academic,
    offer: {
      ...offer.offer,
      demandCompletionMatrix: [],
    },
    alerts: [...academic.alerts, ...offer.alerts],
    qualityNotes: [...academic.qualityNotes, ...offer.qualityNotes],
  };
}
