import "server-only";

import { CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT } from "@/lib/enrollment-attendance-streak";
import { cachedDirector } from "@/lib/diretor/cache";
import {
  aggregateOpportunityRates,
  computeOpportunityRates,
  countServedUniqueStudents,
  countUnjustifiedStreakEligible,
  hasStarted,
  isExecutiveAttendanceReliable,
  type AttendanceMarkRow,
} from "@/lib/diretor/metrics/attendance-formulas";
import type { SessionLike } from "@/lib/diretor/eligible-sessions";
import { assessSessionQuality } from "@/lib/diretor/eligible-sessions";
import type { AcademicExecutiveFacts } from "@/lib/diretor/facts/types";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import { prisma } from "@/lib/prisma";

function pctOrNull(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

async function loadAcademicFactsUncached(scope: ScopeResolution): Promise<AcademicExecutiveFacts> {
  const qualityNotes: string[] = [];
  const quality: AcademicExecutiveFacts["quality"] = [];
  const cgIds = scope.classGroupIds;
  if (cgIds.length === 0) {
    return {
      servedUnique: 0,
      criticalAbsenceRisk: 0,
      completionStartedRate: null,
      callCompletenessRate: null,
      attendanceReliable: false,
      periodLabel: scope.cycleLabel,
      quality: [{ domain: "academic", status: "unavailable", note: "Nenhuma turma no recorte." }],
      qualityNotes: ["Nenhuma turma no recorte."],
    };
  }

  const asOf = scope.dataAsOf;
  const [classGroups, enrollments, sessionsRaw] = await Promise.all([
    prisma.classGroup.findMany({
      where: { id: { in: cgIds } },
      select: { id: true, status: true },
    }),
    prisma.enrollment.findMany({
      where: { classGroupId: { in: cgIds } },
      select: {
        id: true,
        studentId: true,
        classGroupId: true,
        status: true,
        enrolledAt: true,
        enrollmentConfirmedAt: true,
      },
    }),
    prisma.classSession.findMany({
      where: { classGroupId: { in: cgIds } },
      select: { id: true, classGroupId: true, status: true, sessionDate: true, startTime: true },
    }),
  ]);

  const sessions: SessionLike[] = sessionsRaw.map((s) => ({
    id: s.id,
    classGroupId: s.classGroupId,
    status: s.status,
    sessionDate: s.sessionDate,
    startTime: s.startTime,
  }));
  const q = assessSessionQuality(sessions, asOf);
  if (q.pastNotReleasedCount > 0) {
    qualityNotes.push(
      `${q.pastNotReleasedCount} sessão(ões) já ocorridas ainda não foram liberadas e ficam de fora da frequência.`,
    );
    quality.push({
      domain: "academic",
      status: "partial",
      note: "Há sessões já ocorridas que ainda não foram liberadas.",
    });
  }

  const attendance =
    enrollments.length && sessions.length
      ? await prisma.sessionAttendance.findMany({
          where: { enrollmentId: { in: enrollments.map((e) => e.id) } },
          select: { enrollmentId: true, classSessionId: true, present: true, absenceJustification: true },
        })
      : [];
  const attByEnr = new Map<string, Map<string, AttendanceMarkRow>>();
  for (const row of attendance) {
    let m = attByEnr.get(row.enrollmentId);
    if (!m) {
      m = new Map();
      attByEnr.set(row.enrollmentId, m);
    }
    m.set(row.classSessionId, {
      classSessionId: row.classSessionId,
      present: row.present,
      absenceJustification: row.absenceJustification,
    });
  }

  const servedUnique = countServedUniqueStudents(enrollments, sessions, attByEnr, asOf);

  const opportunityRows = enrollments.map((e) => {
    const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt };
    return computeOpportunityRates(entry, sessions, attByEnr.get(e.id) ?? new Map(), asOf);
  });
  const attendanceAgg = aggregateOpportunityRates(opportunityRows);
  const attendanceReliable = isExecutiveAttendanceReliable(attendanceAgg.callCompletenessRate);
  if (!attendanceReliable && attendanceAgg.callCompletenessRate != null) {
    qualityNotes.push(`${attendanceAgg.callCompletenessRate}% das chamadas preenchidas.`);
    quality.push({
      domain: "academic",
      status: "partial",
      note: "Indicadores de presença são leitura parcial: a completude das chamadas está abaixo de 90%.",
    });
  }

  let criticalAbsenceRisk = 0;
  for (const e of enrollments) {
    if (e.status !== "ACTIVE" && e.status !== "SUSPENDED") continue;
    const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt };
    const streak = countUnjustifiedStreakEligible(entry, sessions, attByEnr.get(e.id) ?? new Map(), asOf);
    if (streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT) criticalAbsenceRisk += 1;
  }

  const closed = new Set(classGroups.filter((g) => g.status === "ENCERRADA").map((g) => g.id));
  let completionStartedRate: number | null = null;
  if (closed.size > 0) {
    let startedInClosed = 0;
    let completedStarted = 0;
    for (const e of enrollments) {
      if (!closed.has(e.classGroupId)) continue;
      const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt };
      if (!hasStarted(entry, sessions, attByEnr.get(e.id) ?? new Map(), asOf)) continue;
      startedInClosed += 1;
      if (e.status === "COMPLETED") completedStarted += 1;
    }
    completionStartedRate = pctOrNull(completedStarted, startedInClosed);
  }

  if (quality.length === 0) quality.push({ domain: "academic", status: "ok" });

  return {
    servedUnique,
    criticalAbsenceRisk,
    completionStartedRate,
    callCompletenessRate: attendanceAgg.callCompletenessRate,
    attendanceReliable,
    periodLabel: scope.cycleLabel,
    quality,
    qualityNotes,
  };
}

export async function loadAcademicExecutiveFacts(scope: ScopeResolution, viewer: "DIRECTOR" | "MASTER") {
  return cachedDirector(["facts-academic-v3", scope.scope, scope.cycleId, viewer], () =>
    loadAcademicFactsUncached(scope),
  );
}
