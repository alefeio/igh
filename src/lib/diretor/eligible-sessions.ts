/**
 * Sessões elegíveis canônicas para frequência, streak, alertas e relatórios.
 * Enums reais (Prisma): SCHEDULED | LIBERADA | CANCELED.
 */

export type ClassSessionStatusCanon = "SCHEDULED" | "LIBERADA" | "CANCELED";

export type SessionLike = {
  id: string;
  classGroupId: string;
  status: ClassSessionStatusCanon | string;
  /** Data da sessão (date-only ou instante). */
  sessionDate: Date;
  startTime?: string | null;
};

export type EnrollmentEntryLike = {
  id: string;
  classGroupId: string;
  /** Momento a partir do qual o aluno entra na turma (enrolledAt / confirmedAt). */
  enteredAt: Date;
};

export type EligibleSessionQuality = {
  /** Sessões com data ≤ dataAsOf que ainda estão SCHEDULED (não liberadas). */
  pastNotReleasedCount: number;
  pastNotReleasedSessionIds: string[];
  canceledCount: number;
  futureCount: number;
};

function sessionInstant(session: SessionLike): Date {
  const d = session.sessionDate;
  const t = (session.startTime ?? "00:00").trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(t);
  const hours = match ? Number(match[1]) : 0;
  const minutes = match ? Number(match[2]) : 0;
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      hours,
      minutes,
      0,
      0,
    ),
  );
}

/** Sessão já ocorreu / liberada em relação a dataAsOf e não está cancelada/futura. */
export function isSessionReleasedAndDue(session: SessionLike, dataAsOf: Date): boolean {
  if (session.status === "CANCELED") return false;
  if (session.status !== "LIBERADA") return false;
  return sessionInstant(session).getTime() <= dataAsOf.getTime();
}

export function assessSessionQuality(
  sessions: SessionLike[],
  dataAsOf: Date,
): EligibleSessionQuality {
  let pastNotReleasedCount = 0;
  const pastNotReleasedSessionIds: string[] = [];
  let canceledCount = 0;
  let futureCount = 0;
  const asOf = dataAsOf.getTime();

  for (const s of sessions) {
    if (s.status === "CANCELED") {
      canceledCount += 1;
      continue;
    }
    const instant = sessionInstant(s).getTime();
    if (instant > asOf) {
      futureCount += 1;
      continue;
    }
    if (s.status === "SCHEDULED") {
      pastNotReleasedCount += 1;
      pastNotReleasedSessionIds.push(s.id);
    }
  }

  return {
    pastNotReleasedCount,
    pastNotReleasedSessionIds,
    canceledCount,
    futureCount,
  };
}

/**
 * Sessões elegíveis da turma para um aluno (após entrada).
 * Ordenação: mais recente primeiro (streak) ou crescente (oportunidades).
 */
export function filterEligibleSessionsForEnrollment(
  sessions: SessionLike[],
  enrollment: EnrollmentEntryLike,
  dataAsOf: Date,
  order: "asc" | "desc" = "asc",
): SessionLike[] {
  const entryMs = enrollment.enteredAt.getTime();
  const filtered = sessions.filter((s) => {
    if (s.classGroupId !== enrollment.classGroupId) return false;
    if (!isSessionReleasedAndDue(s, dataAsOf)) return false;
    return sessionInstant(s).getTime() >= entryMs;
  });
  filtered.sort((a, b) => {
    const da = sessionInstant(a).getTime() - sessionInstant(b).getTime();
    return order === "asc" ? da : -da;
  });
  return filtered;
}

export function filterEligibleSessionsForClassGroup(
  sessions: SessionLike[],
  classGroupId: string,
  dataAsOf: Date,
): SessionLike[] {
  return sessions
    .filter((s) => s.classGroupId === classGroupId && isSessionReleasedAndDue(s, dataAsOf))
    .sort((a, b) => sessionInstant(a).getTime() - sessionInstant(b).getTime());
}
