import { weeklyScheduleOverlaps } from "@/lib/class-group-overlap";
import type { ClassGroupUnit } from "@/lib/class-group-unit";

/** Turma disponível para pré-matrícula, conforme `GET /api/public/class-groups`. */
export type ClassGroupOption = {
  id: string;
  cycleId: string;
  courseId: string;
  courseName: string;
  courseDescription?: string | null;
  startDate: string;
  endDate?: string | null;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  location: string | null;
  unit?: ClassGroupUnit;
  capacity?: number;
  seatsLeft?: number;
  /** Turma lotada: inscrição vai para lista de espera. */
  waitlistOnly?: boolean;
  status: string;
};

/** Formata uma data (YYYY-MM-DD ou ISO completo) para pt-BR sem mudança de fuso. */
export function formatDateOnlyBR(isoDate: string): string {
  const datePart = isoDate.trim().split("T")[0] ?? isoDate.trim();
  const parts = datePart.split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return isoDate;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

/** Verifica se duas turmas têm dia e horário sobrepostos. */
export function doOverlap(a: ClassGroupOption, b: ClassGroupOption): boolean {
  return weeklyScheduleOverlaps(a, b);
}

/** Texto da situação das vagas, quando a API informa o total restante. */
export function seatsLabel(cg: ClassGroupOption): string | null {
  if (typeof cg.seatsLeft !== "number") return null;
  if (cg.seatsLeft <= 0 || cg.waitlistOnly) return "Lista de espera";
  if (cg.seatsLeft === 1) return "Última vaga";
  if (cg.seatsLeft <= 3) return `Últimas ${cg.seatsLeft} vagas`;
  return `${cg.seatsLeft} vagas`;
}
