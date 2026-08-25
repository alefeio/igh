import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  countServedUniqueStudents,
  countUnjustifiedStreakEligible,
  hasStarted,
  isExecutiveAttendanceReliable,
} from "@/lib/diretor/metrics/attendance-formulas";
import type { SessionLike } from "@/lib/diretor/eligible-sessions";
import {
  classifyAbsenceExecutive,
  countAbsenceProgression,
  executivePresenceCount,
  isCycleEnrollment,
  occupiesCurrentSeat,
} from "@/lib/diretor/metrics/enrollment-formulas";
import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import { alertsFromExecutiveFacts } from "@/lib/diretor/alerts/engine";

function session(
  partial: Partial<SessionLike> & Pick<SessionLike, "id" | "status" | "sessionDate">,
): SessionLike {
  return { classGroupId: "cg1", startTime: "09:00", ...partial };
}

const asOf = new Date("2026-08-21T15:00:00.000Z");
const entry = { id: "e1", classGroupId: "cg1", enteredAt: new Date("2026-08-01T00:00:00.000Z") };

function released(ids: string[]) {
  return ids.map((id, i) =>
    session({ id, status: "LIBERADA", sessionDate: new Date(`2026-08-${String(5 + i * 7).padStart(2, "0")}T00:00:00.000Z`) }),
  );
}

function unjustified(id: string) {
  return [id, { classSessionId: id, present: false, absenceJustification: null }] as const;
}

describe("Diretor 1C.1 — matrícula, ocupação e faltas", () => {
  it("usa versão 1C.1.0", () => {
    expect(FORMULA_VERSION_1C).toBe("1C.1.0");
  });

  it("matrícula sem confirmação conta como matrícula do ciclo", () => {
    expect(isCycleEnrollment({ isPreEnrollment: true, enrollmentConfirmedAt: null })).toBe(true);
    expect(isCycleEnrollment({ isPreEnrollment: false, enrollmentConfirmedAt: new Date() })).toBe(true);
  });

  it("matrícula sem confirmação com presença conta como iniciada e atendida", () => {
    const sessions = released(["s1"]);
    const att = new Map([["s1", { classSessionId: "s1", present: true, absenceJustification: null }]]);
    expect(hasStarted(entry, sessions, att, asOf)).toBe(true);
    const n = countServedUniqueStudents(
      [{ id: "e1", studentId: "st1", classGroupId: "cg1", enrolledAt: entry.enteredAt, enrollmentConfirmedAt: null }],
      sessions,
      new Map([["e1", att]]),
      asOf,
    );
    expect(n).toBe(1);
  });

  it("ativa e suspensa ocupam vaga em turma vigente; cancelada e concluída não", () => {
    expect(occupiesCurrentSeat({ enrollmentStatus: "ACTIVE", classGroupStatus: "ABERTA" })).toBe(true);
    expect(occupiesCurrentSeat({ enrollmentStatus: "SUSPENDED", classGroupStatus: "EM_ANDAMENTO" })).toBe(true);
    expect(occupiesCurrentSeat({ enrollmentStatus: "CANCELLED", classGroupStatus: "ABERTA" })).toBe(false);
    expect(occupiesCurrentSeat({ enrollmentStatus: "COMPLETED", classGroupStatus: "ABERTA" })).toBe(false);
    expect(occupiesCurrentSeat({ enrollmentStatus: "ACTIVE", classGroupStatus: "ENCERRADA" })).toBe(false);
  });

  it("não imputa causa ao status: três faltas ≠ suspenso; quatro faltas ≠ cancelamento confirmado", () => {
    expect(classifyAbsenceExecutive({ status: "ACTIVE", streak: 2 })).toBe("near_suspension");
    expect(classifyAbsenceExecutive({ status: "ACTIVE", streak: 3 })).toBe("identified_three");
    expect(classifyAbsenceExecutive({ status: "SUSPENDED", streak: 3 })).toBe("identified_three");
    expect(classifyAbsenceExecutive({ status: "SUSPENDED", streak: 0 })).toBe("none");
    expect(classifyAbsenceExecutive({ status: "CANCELLED", streak: 4 })).toBe("cancellation_inferred");
    expect(classifyAbsenceExecutive({ status: "ACTIVE", streak: 4 })).toBe("unprocessed_cancellation");
  });

  it("separa suspensos, streaks e cancelamentos sem misturar totais", () => {
    const counts = countAbsenceProgression([
      { status: "ACTIVE", streak: 2 },
      { status: "ACTIVE", streak: 3 },
      { status: "SUSPENDED", streak: 0 },
      { status: "CANCELLED", streak: 4 },
      { status: "CANCELLED", streak: 0 },
      { status: "ACTIVE", streak: 4 },
    ]);
    expect(counts.suspendedNow).toBe(1);
    expect(counts.streakTwo).toBe(1);
    expect(counts.streakThree).toBe(1);
    expect(counts.cancelledUnknownReason).toBe(2);
    expect(counts.cancelledKnownReason).toBe(0);
    expect(counts.cancelledInferredAfterFour).toBe(1);
    expect(counts.unprocessedFour).toBe(1);
    expect(counts.suspendedNow + counts.streakThree).not.toBe(counts.suspendedNow);
  });

  it("falta justificada não avança streak", () => {
    const sessions = released(["s1", "s2"]);
    const att = new Map([
      ["s2", { classSessionId: "s2", present: false, absenceJustification: "Atestado" }],
      ["s1", { classSessionId: "s1", present: false, absenceJustification: null }],
    ]);
    expect(countUnjustifiedStreakEligible(entry, sessions, att, asOf)).toBe(0);
  });

  it("sessão desconhecida interrompe streak", () => {
    const sessions = [
      session({ id: "s1", status: "LIBERADA", sessionDate: new Date("2026-08-05T00:00:00.000Z") }),
      session({ id: "s2", status: "SCHEDULED", sessionDate: new Date("2026-08-12T00:00:00.000Z") }),
      session({ id: "s3", status: "LIBERADA", sessionDate: new Date("2026-08-19T00:00:00.000Z") }),
    ];
    const att = new Map([unjustified("s1"), unjustified("s3")]);
    expect(countUnjustifiedStreakEligible(entry, sessions, att, asOf)).toBe(1);
  });

  it("chamadas abaixo de 90% são leitura parcial e zero de presença não é resultado", () => {
    expect(isExecutiveAttendanceReliable(64.6)).toBe(false);
    expect(executivePresenceCount(0, false).quality).toBe("unavailable");
    expect(executivePresenceCount(0, false).value).toBeNull();
    expect(executivePresenceCount(5, false).quality).toBe("partial");
  });

  it("alertas: duas faltas atenção, suspensos críticos, quatro processados como resultado", () => {
    const alerts = alertsFromExecutiveFacts({
      academic: {
        servedUnique: 10,
        enrollmentsInCycle: 20,
        occupyingSeats: 12,
        uniquePeople: 18,
        suspensions: 3,
        nearSuspension: 2,
        cancelled: 4,
        cancelledKnownReason: 0,
        cancelledUnknownReason: 4,
        cancelledInferredAfterFour: 0,
        streakThree: 1,
        unprocessedFourAbsences: 0,
        criticalAbsenceRisk: 1,
        completionStartedRate: null,
        callCompletenessRate: 95,
        attendanceReliable: true,
        periodLabel: "ciclo",
        quality: [{ domain: "academic", status: "ok" }],
        qualityNotes: [],
      },
    });
    expect(alerts.find((a) => a.id === "acad-near-suspension")?.severity).toBe("attention");
    expect(alerts.find((a) => a.id === "acad-near-suspension")?.suggestedDecision).toMatch(/contato preventivo/);
    expect(alerts.find((a) => a.id === "acad-suspensions")?.severity).toBe("critical");
    expect(alerts.find((a) => a.id === "acad-suspensions")?.fact).toMatch(/não está registrada/);
    expect(alerts.find((a) => a.id === "acad-streak-three")?.severity).toBe("critical");
    expect(alerts.find((a) => a.id === "acad-cancellations-stock")?.severity).toBe("info");
    expect(alerts.find((a) => a.id === "acad-cancellations-period")).toBeUndefined();
    expect(JSON.stringify(alerts)).not.toMatch(/evasão/i);
    expect(JSON.stringify(alerts)).not.toMatch(/pré-matr/i);
    expect(JSON.stringify(alerts)).not.toMatch(/matrícula confirmad/i);
    expect(JSON.stringify(alerts)).not.toMatch(/pré-matr/i);
  });

  it("páginas, guia e relatórios executivos não usam pré-matrícula nem confirmada", () => {
    const files = [
      "src/app/(protected)/diretor/page.tsx",
      "src/app/(protected)/diretor/prioridades/page.tsx",
      "src/app/(protected)/diretor/academico/page.tsx",
      "src/app/(protected)/diretor/oferta-territorios/page.tsx",
      "src/app/(protected)/diretor/impacto-social/page.tsx",
      "src/app/(protected)/diretor/relatorios/page.tsx",
      "src/app/api/diretor/guide/route.ts",
      "src/lib/diretor/reports/generate.ts",
      "src/lib/diretor/reports/pdf.ts",
      "src/lib/diretor/reports/xlsx.ts",
      "src/lib/diretor/alerts/engine.ts",
    ];
    const blob = files.map((f) => readFileSync(path.join(process.cwd(), f), "utf8")).join("\n");
    expect(blob.toLowerCase()).not.toMatch(/pré-matr/);
    expect(blob.toLowerCase()).not.toMatch(/pre-matr/);
    expect(blob.toLowerCase()).not.toMatch(/matrícula confirmad/);
    expect(blob.toLowerCase()).not.toMatch(/evasão/);
  });
});
