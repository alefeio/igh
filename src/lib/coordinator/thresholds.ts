import { CERTIFICATE_ATTENDANCE_THRESHOLD_PERCENT } from "@/lib/certificate-attendance-threshold";

/**
 * Limites da coordenação pedagógica.
 * O corte de frequência reutiliza o limiar do certificado.
 * Os demais valores ficam só aqui.
 */
export const COORDINATOR_THRESHOLDS = {
  attendanceRiskPercent: CERTIFICATE_ATTENDANCE_THRESHOLD_PERCENT,
  attendanceCriticalPercent: 50,
  consecutiveAbsencesWarning: 2,
  consecutiveAbsencesCritical: 4,
  earlyDropoutAttendanceShare: 0.25,
  progressAttentionPercent: 40,
  scoreAttentionPercent: 60,
  lmsInactiveDays: 7,
  classDropoutAttentionShare: 0.2,
  retentionMarks: [25, 50, 75, 100] as const,
  /** Janela de aulas lançadas antes e depois de uma intervenção. Cursos curtos não usam semanas civis. */
  interventionSessionWindow: 4,
} as const;

export type CoordinatorThresholds = typeof COORDINATOR_THRESHOLDS;
