import type { ClassGroupStatus } from "@/generated/prisma/client";

export const TEACHER_CLASS_GROUP_TABS = [
  "em_andamento",
  "planejadas",
  "encerradas",
  "canceladas",
] as const;

export type TeacherClassGroupTab = (typeof TEACHER_CLASS_GROUP_TABS)[number];

export const TEACHER_CLASS_GROUP_TAB_LABELS: Record<TeacherClassGroupTab, string> = {
  em_andamento: "Em andamento",
  planejadas: "Planejadas",
  encerradas: "Encerradas",
  canceladas: "Canceladas",
};

const TAB_STATUS_MAP: Record<TeacherClassGroupTab, ClassGroupStatus[]> = {
  em_andamento: ["EM_ANDAMENTO", "ABERTA", "INTERNO", "EXTERNO"],
  planejadas: ["PLANEJADA"],
  encerradas: ["ENCERRADA"],
  canceladas: ["CANCELADA"],
};

export function statusesForTeacherClassGroupTab(tab: string): ClassGroupStatus[] | null {
  if (tab in TAB_STATUS_MAP) {
    return TAB_STATUS_MAP[tab as TeacherClassGroupTab];
  }
  return null;
}

export function isTeacherClassGroupTab(tab: string): tab is TeacherClassGroupTab {
  return (TEACHER_CLASS_GROUP_TABS as readonly string[]).includes(tab);
}
