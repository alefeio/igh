export type JourneyKind =
  | "PRE_ENROLLMENT"
  | "CONFIRMED_WAITING_CLASS"
  | "NO_SHOW"
  | "EARLY_DROPOUT"
  | "DROPOUT"
  | "SUSPENDED"
  | "TRANSFERRED"
  | "COMPLETED"
  | "CANCELLED_ADMIN"
  | "CANCELLED_UNCLASSIFIED"
  | "ACTIVE"
  | "INSUFFICIENT_DATA";

export type RiskLevel = "CRITICAL" | "WARNING" | "ATTENTION";

export type DepartureReasonCode =
  | "WORK_SCHEDULE"
  | "ADDRESS_CHANGE"
  | "TRANSPORTATION"
  | "HEALTH"
  | "LOSS_OF_INTEREST"
  | "EXPECTATION_MISMATCH"
  | "LEARNING_DIFFICULTY"
  | "METHODOLOGY_OR_TEACHER"
  | "LACK_OF_EQUIPMENT"
  | "EMPLOYMENT"
  | "TRANSFER"
  | "UNREACHABLE"
  | "ABANDONMENT_WITHOUT_REASON"
  | "ADMINISTRATIVE"
  | "OTHER";

export type Indicator = {
  value: number | null;
  available: boolean;
  definition: string;
};

export type EnrollmentSignalInput = {
  id: string;
  studentName: string;
  status: string;
  isPreEnrollment: boolean;
  confirmed: boolean;
  /** Apto a certificado (presença ≥70% ou marcação do professor). */
  certificateEligible?: boolean | null;
  /** Aulas já realizadas da turma (não canceladas, até hoje). */
  heldSessions: number;
  presentCount: number;
  /** Faltas explícitas (present = false) no fim da sequência já lançada. */
  consecutiveAbsences: number;
  /** Progresso no conteúdo, 0–100. Null quando o curso não tem aulas lançadas. */
  progressPercent: number | null;
  /** Dias desde o último acesso ao conteúdo. Null quando nunca houve acesso registrado. */
  lmsInactiveDays: number | null;
  /** Média das provas enviadas. Null quando não há prova corrigida. */
  scorePercent: number | null;
  classClosed: boolean;
  recordedReason?: DepartureReasonCode | null;
};

export type ClassifiedEnrollment = {
  id: string;
  studentName: string;
  kind: JourneyKind;
  /** Entra na coorte acadêmica (não é só pré-matrícula sem confirmação). */
  inAcademicCohort: boolean;
  started: boolean;
  riskLevel: RiskLevel | null;
  riskReasons: string[];
  attendancePercent: number | null;
};

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
};

export type RetentionPoint = {
  mark: number;
  label: string;
  count: number;
};

export type RiskStudent = {
  enrollmentId: string;
  studentName: string;
  level: RiskLevel;
  reasons: string[];
  attendancePercent: number | null;
};
