/**
 * Limites da coordenação pedagógica.
 * O corte de 70% reaproveita a regra já usada para aptidão de certificado.
 * Os demais valores ficam só aqui, para não se espalharem pela interface.
 */
export const COORDINATOR_THRESHOLDS = {
  attendanceRiskPercent: 70,
  attendanceCriticalPercent: 50,
  consecutiveAbsencesWarning: 2,
  consecutiveAbsencesCritical: 4,
  earlyDropoutAttendanceShare: 0.25,
  progressAttentionPercent: 40,
  scoreAttentionPercent: 60,
  lmsInactiveDays: 7,
  classDropoutAttentionShare: 0.2,
  retentionMarks: [25, 50, 75, 100] as const,
} as const;

export type CoordinatorThresholds = typeof COORDINATOR_THRESHOLDS;
