import { FORMULA_VERSION_1C, getMetricDefinition } from "@/lib/diretor/catalog/definitions";
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
    explanation?: string;
    currentValue?: number | null;
    targetValue?: number | null;
    percentage?: number | null;
    formattedValue?: string;
  },
): MetricValueDto {
  const def = getMetricDefinition(metricId);
  return {
    metricId,
    label: opts.labelOverride ?? def?.name ?? metricId,
    value: opts.formattedValue ?? value,
    unit: def?.unit,
    unavailableReason: opts.unavailableReason ?? null,
    quality: opts.quality,
    formulaVersion: opts.formulaVersion ?? def?.formulaVersion ?? FORMULA_VERSION_1C,
    formula: def?.formula ?? "",
    denominator: def?.denominator,
    explanation: opts.explanation,
    href: opts.href,
    currentValue: opts.currentValue,
    targetValue: opts.targetValue,
    percentage: opts.percentage,
    formattedValue: opts.formattedValue,
  };
}
