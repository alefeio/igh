import { FORMULA_VERSION_1A, FORMULA_VERSION_1B, getMetricDefinition } from "@/lib/diretor/catalog/definitions";
import type { MetricValueDto } from "@/lib/diretor/schemas/common";

export function metricCard(
  metricId: string,
  value: number | string | null,
  opts: {
    quality: MetricValueDto["quality"];
    unavailableReason?: string | null;
    href?: string;
    labelOverride?: string;
    formulaVersion?: string;
  },
): MetricValueDto {
  const def = getMetricDefinition(metricId);
  return {
    metricId,
    label: opts.labelOverride ?? def?.name ?? metricId,
    value,
    unit: def?.unit,
    unavailableReason: opts.unavailableReason ?? null,
    quality: opts.quality,
    formulaVersion: opts.formulaVersion ?? def?.formulaVersion ?? FORMULA_VERSION_1B ?? FORMULA_VERSION_1A,
    formula: def?.formula ?? "",
    denominator: def?.denominator,
    href: opts.href,
  };
}
