import type { AcademicBundle } from "@/lib/diretor/metrics/academic";
import type { OfferBundle } from "@/lib/diretor/metrics/offer";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";

export type AcademicOfferBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  academic: AcademicBundle["academic"];
  offer: OfferBundle["offer"] & {
    demandCompletionMatrix: Array<{
      courseId: string;
      courseName: string;
      demandProxy: number;
      completionStartedRate: number | null;
      quadrant: "expand" | "review_execution" | "review_marketing" | "reassess" | "unavailable";
    }>;
  };
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
};
