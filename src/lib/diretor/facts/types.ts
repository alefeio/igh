import type { DerivedAlertDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";

export type AcademicExecutiveFacts = {
  servedUnique: number;
  enrollmentsInCycle: number;
  occupyingSeats: number;
  uniquePeople: number;
  suspensions: number;
  nearSuspension: number;
  streakThree: number;
  cancelled: number;
  cancelledKnownReason: number;
  cancelledUnknownReason: number;
  cancelledInferredAfterFour: number;
  unprocessedFourAbsences: number;
  criticalAbsenceRisk: number;
  completionStartedRate: number | null;
  callCompletenessRate: number | null;
  attendanceReliable: boolean;
  periodLabel: string;
  quality: ResponseMetaDto["quality"];
  qualityNotes: string[];
};

export type OfferExecutiveFacts = {
  occupancyPercent: number | null;
  emptyClasses: number;
  below30: number;
  waitlist: number;
  periodLabel: string;
  quality: ResponseMetaDto["quality"];
  qualityNotes: string[];
};

export type SocialExecutiveFacts = {
  computersDonated: number;
  computersTarget: number | null;
  computersProgressPct: number | null;
  periodLabel: string;
  quality: ResponseMetaDto["quality"];
  qualityNotes: string[];
};

export type FinancialExecutiveFacts = {
  netPaidCents: number;
  apCents: number;
  arCents: number;
  openAge91PlusCents: number;
  periodLabel: string;
  quality: ResponseMetaDto["quality"];
  qualityNotes: string[];
};

export type AdministrativeExecutiveFacts = {
  contractsExpired: number;
  pendingDocuments: number;
  inventoryZero: number;
  inventoryBelowMin: number;
  stockCritical: number;
  periodLabel: string;
  quality: ResponseMetaDto["quality"];
  qualityNotes: string[];
};

export type ProjectExecutiveFacts = {
  unavailable: true;
  periodLabel: string;
  quality: ResponseMetaDto["quality"];
  qualityNotes: string[];
};

export type FactsWithAlerts<T> = T & { alerts: DerivedAlertDto[] };
