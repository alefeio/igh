import type {
  TechnicalVisitClassification,
  TechnicalVisitItemStatus,
} from "@/generated/prisma/client";

export type TechnicalVisitView = {
  id: string;
  locationName: string;
  municipality: string;
  state: string;
  address: string | null;
  localContact: string | null;
  visitedAt: string;
  visitors: string | null;
  metaStudents: number | null;
  metaClassGroups: number | null;
  metaStudentsPerClass: number | null;
  classDuration: string | null;
  classesPerWeek: string | null;
  classDays: string | null;
  pedagogicalPlan: string | null;
  structuralStandards: string | null;
  finalClassification: TechnicalVisitClassification;
  finalNotes: string | null;
  donatariaId: string | null;
  donataria: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: { id: string; name: string } | null;
  checklistItems: Array<{
    id: string;
    key: string;
    label: string;
    standard: string;
    status: TechnicalVisitItemStatus;
    observation: string | null;
    sortOrder: number;
  }>;
  okCount: number;
  pendingCount: number;
  checklistTotal: number;
};

export const TECHNICAL_VISIT_CLASSIFICATION_LABEL: Record<
  TechnicalVisitClassification,
  string
> = {
  APTA: "Apta",
  APTA_COM_PENDENCIAS: "Apta com pendências",
  INAPTA: "Inapta",
};

export const TECHNICAL_VISIT_ITEM_STATUS_LABEL: Record<TechnicalVisitItemStatus, string> = {
  OK: "OK",
  PENDENTE: "Pendente",
  NAO_APLICAVEL: "Não aplicável",
};
