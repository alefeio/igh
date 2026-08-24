import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT } from "@/lib/enrollment-attendance-streak";
import { cachedDirector } from "@/lib/diretor/cache";
import {
  countUnjustifiedStreakEligible,
  hasStarted,
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
      periodLabel: scope.cycleLabel,
      quality: [{ domain: "academic", status: "unavailable", note: "Nenhuma turma no recorte." }],
      qualityNotes: ["Nenhuma turma no recorte."],
    };
  }

  const asOf = scope.dataAsOf;
  const classGroups = await prisma.classGroup.findMany({
    where: { id: { in: cgIds } },
    select: { id: true, status: true },
  });
  const closed = new Set(classGroups.filter((g) => g.status === "ENCERRADA").map((g) => g.id));

  const [servedRows, pastNotReleased, riskEnrollments] = await Promise.all([
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n FROM (
        SELECT DISTINCT e."studentId"
        FROM "SessionAttendance" sa
        INNER JOIN "Enrollment" e ON e.id = sa."enrollmentId"
        INNER JOIN "ClassSession" cs ON cs.id = sa."classSessionId"
        WHERE sa.present = true
          AND e."classGroupId"::text IN (${Prisma.join(cgIds)})
          AND cs.status = 'LIBERADA'
          AND cs."sessionDate" <= ${asOf}
          AND cs."sessionDate" >= DATE(COALESCE(e."enrollmentConfirmedAt", e."enrolledAt"))
      ) t
    `,
    prisma.classSession.count({
      where: { classGroupId: { in: cgIds }, status: "SCHEDULED", sessionDate: { lte: asOf } },
    }),
    prisma.enrollment.findMany({
      where: { classGroupId: { in: cgIds }, status: { in: ["ACTIVE", "SUSPENDED"] } },
      select: {
        id: true,
        classGroupId: true,
        status: true,
        enrolledAt: true,
        enrollmentConfirmedAt: true,
      },
    }),
  ]);

  const servedUnique = Number(servedRows[0]?.n ?? 0);
  if (pastNotReleased > 0) {
    qualityNotes.push(`${pastNotReleased} sessão(ões) passadas ainda em SCHEDULED.`);
    quality.push({ domain: "academic", status: "partial", note: "Há sessões passadas não liberadas." });
  }

  let criticalAbsenceRisk = 0;
  if (riskEnrollments.length > 0) {
    const riskCg = [...new Set(riskEnrollments.map((e) => e.classGroupId))];
    const sessionsRaw = await prisma.classSession.findMany({
      where: { classGroupId: { in: riskCg }, status: { in: ["LIBERADA", "SCHEDULED"] } },
      select: { id: true, classGroupId: true, status: true, sessionDate: true, startTime: true },
    });
    const sessions: SessionLike[] = sessionsRaw.map((s) => ({
      id: s.id,
      classGroupId: s.classGroupId,
      status: s.status,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
    }));
    const q = assessSessionQuality(sessions, asOf);
    if (q.pastNotReleasedCount > 0 && quality.every((x) => x.note !== "Há sessões passadas não liberadas.")) {
      quality.push({ domain: "academic", status: "partial", note: "Há sessões passadas não liberadas." });
    }
    const att = await prisma.sessionAttendance.findMany({
      where: { enrollmentId: { in: riskEnrollments.map((e) => e.id) } },
      select: { enrollmentId: true, classSessionId: true, present: true, absenceJustification: true },
    });
    const attByEnr = new Map<string, Map<string, AttendanceMarkRow>>();
    for (const row of att) {
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
    for (const e of riskEnrollments) {
      const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt };
      const streak = countUnjustifiedStreakEligible(entry, sessions, attByEnr.get(e.id) ?? new Map(), asOf);
      if (streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT) criticalAbsenceRisk += 1;
    }
  }

  let completionStartedRate: number | null = null;
  if (closed.size > 0) {
    const closedIds = [...closed];
    const closedEnr = await prisma.enrollment.findMany({
      where: { classGroupId: { in: closedIds } },
      select: {
        id: true,
        classGroupId: true,
        status: true,
        enrolledAt: true,
        enrollmentConfirmedAt: true,
      },
    });
    const closedSessions = await prisma.classSession.findMany({
      where: { classGroupId: { in: closedIds }, status: "LIBERADA" },
      select: { id: true, classGroupId: true, status: true, sessionDate: true, startTime: true },
    });
    const sessions: SessionLike[] = closedSessions.map((s) => ({
      id: s.id,
      classGroupId: s.classGroupId,
      status: s.status,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
    }));
    const present = closedEnr.length
      ? await prisma.sessionAttendance.findMany({
          where: { present: true, enrollmentId: { in: closedEnr.map((e) => e.id) } },
          select: { enrollmentId: true, classSessionId: true },
        })
      : [];
    const attByEnr = new Map<string, Map<string, AttendanceMarkRow>>();
    for (const row of present) {
      let m = attByEnr.get(row.enrollmentId);
      if (!m) {
        m = new Map();
        attByEnr.set(row.enrollmentId, m);
      }
      m.set(row.classSessionId, {
        classSessionId: row.classSessionId,
        present: true,
        absenceJustification: null,
      });
    }
    let startedInClosed = 0;
    let completedStarted = 0;
    for (const e of closedEnr) {
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
    periodLabel: scope.cycleLabel,
    quality,
    qualityNotes,
  };
}

export async function loadAcademicExecutiveFacts(scope: ScopeResolution, viewer: "DIRECTOR" | "MASTER") {
  return cachedDirector(["facts-academic", scope.scope, scope.cycleId, viewer], () =>
    loadAcademicFactsUncached(scope),
  );
}
