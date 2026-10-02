import { describe, expect, it } from "vitest";

import { canViewCoordinatorPedagogy } from "@/lib/coordinator/access";
import { classifyEnrollment } from "@/lib/coordinator/classify";
import { learningGainFromAttempts } from "@/lib/coordinator/learning-gain";
import { observedAttendanceChange } from "@/lib/coordinator/intervention-window";
import { buildStudentSheet } from "@/lib/coordinator/student-sheet";
import type { EnrollmentSignalInput } from "@/lib/coordinator/types";

function signal(partial: Partial<EnrollmentSignalInput> & Pick<EnrollmentSignalInput, "id" | "status">): EnrollmentSignalInput {
  return {
    studentName: "Aluno",
    isPreEnrollment: false,
    confirmed: true,
    heldSessions: 0,
    presentCount: 0,
    consecutiveAbsences: 0,
    progressPercent: null,
    lmsInactiveDays: null,
    scorePercent: null,
    classClosed: false,
    ...partial,
  };
}

describe("ficha, ganho e acesso", () => {
  it("monta a ficha sem inventar frequência quando não há aula", () => {
    const sheet = buildStudentSheet({
      signal: signal({ id: "e1", status: "ACTIVE" }),
      enrolledAt: "2026-02-01",
      confirmedAt: null,
      firstPresentAt: null,
      absences: 0,
      justifiedAbsences: 0,
      sessions: [],
      lessonsTotal: 0,
      lessonsCompleted: 0,
      lessonsStarted: 0,
      lastActivityAt: null,
      exercisesAnswered: 0,
      exercisesCorrect: 0,
      examsSubmitted: 0,
      examsPending: 0,
      departureReason: null,
      events: [{ at: "2026-02-01", label: "Matrícula" }],
    });
    expect(sheet.attendance.percent).toBeNull();
    expect(sheet.performance.accuracy).toBeNull();
    expect(sheet.hasAcademicData).toBe(false);
    expect(sheet.timeline).toHaveLength(1);
  });

  it("reúne frequência, progresso e provas quando existem", () => {
    const sheet = buildStudentSheet({
      signal: signal({
        id: "e2",
        status: "ACTIVE",
        heldSessions: 4,
        presentCount: 3,
        consecutiveAbsences: 1,
        progressPercent: 50,
        scorePercent: 80,
      }),
      enrolledAt: "2026-02-01",
      confirmedAt: "2026-02-02",
      firstPresentAt: "2026-02-03",
      absences: 1,
      justifiedAbsences: 1,
      sessions: [],
      lessonsTotal: 4,
      lessonsCompleted: 2,
      lessonsStarted: 3,
      lastActivityAt: "2026-03-01",
      exercisesAnswered: 4,
      exercisesCorrect: 3,
      examsSubmitted: 1,
      examsPending: 1,
      departureReason: null,
      events: [],
    });
    expect(sheet.attendance.percent).toBe(75);
    expect(sheet.progress.completed).toBe(2);
    expect(sheet.performance.accuracy).toBe(75);
    expect(sheet.performance.score).toBe(80);
  });

  it("não calcula ganho só com diagnóstica, só com final ou sem provas", () => {
    expect(learningGainFromAttempts([{ enrollmentId: "a", kind: "DIAGNOSTIC", scorePercent: 40 }]).available).toBe(false);
    expect(learningGainFromAttempts([{ enrollmentId: "a", kind: "FINAL", scorePercent: 80 }]).available).toBe(false);
    expect(learningGainFromAttempts([]).available).toBe(false);
  });

  it("média várias diagnósticas e várias finais só de quem fez os dois", () => {
    const gain = learningGainFromAttempts([
      { enrollmentId: "a", kind: "DIAGNOSTIC", scorePercent: 40 },
      { enrollmentId: "a", kind: "DIAGNOSTIC", scorePercent: 60 },
      { enrollmentId: "a", kind: "FINAL", scorePercent: 80 },
      { enrollmentId: "a", kind: "FINAL", scorePercent: 100 },
      { enrollmentId: "b", kind: "DIAGNOSTIC", scorePercent: 10 },
      { enrollmentId: "c", kind: "FORMATIVE", scorePercent: 100 },
    ]);
    expect(gain.available).toBe(true);
    expect(gain.comparedStudents).toBe(1);
    expect(gain.initial).toBe(50);
    expect(gain.final).toBe(90);
    expect(gain.gain).toBe(40);
  });

  it("transferência e cancelamento administrativo não são evasão; cancelado sem motivo e sem aula não vira no-show", () => {
    expect(classifyEnrollment(signal({ id: "t", status: "CANCELLED", recordedReason: "TRANSFER", presentCount: 2, heldSessions: 4 })).kind).toBe("TRANSFERRED");
    expect(classifyEnrollment(signal({ id: "adm", status: "CANCELLED", recordedReason: "ADMINISTRATIVE", presentCount: 2, heldSessions: 4 })).kind).toBe("CANCELLED_ADMIN");
    expect(classifyEnrollment(signal({ id: "sem", status: "CANCELLED", heldSessions: 0 })).kind).toBe("INSUFFICIENT_DATA");
    expect(classifyEnrollment(signal({ id: "ns", status: "CANCELLED", heldSessions: 3, presentCount: 0 })).kind).toBe("NO_SHOW");
  });

  it("intervenção sem aula posterior não inventa evolução", () => {
    const change = observedAttendanceChange(
      [{ at: "2026-03-01", present: false }],
      "2026-03-10",
    );
    expect(change.available).toBe(false);
    expect(change.after).toBeNull();
  });

  it("compara as aulas imediatamente antes e depois da intervenção", () => {
    const change = observedAttendanceChange(
      [
        { at: "2026-03-01", present: false },
        { at: "2026-03-08", present: true },
        { at: "2026-03-20", present: true },
        { at: "2026-03-27", present: true },
      ],
      "2026-03-10",
    );
    expect(change.before).toBe(50);
    expect(change.after).toBe(100);
    expect(change.delta).toBe(50);
    expect(change.note).toMatch(/não estabelece causalidade/);
  });

  it("libera coordenação pedagógica só para os papéis previstos", () => {
    expect(canViewCoordinatorPedagogy("COORDINATOR")).toBe(true);
    expect(canViewCoordinatorPedagogy("DIRECTOR")).toBe(true);
    expect(canViewCoordinatorPedagogy("MASTER")).toBe(true);
    expect(canViewCoordinatorPedagogy("GENERAL_ADMIN")).toBe(true);
    expect(canViewCoordinatorPedagogy("TEACHER")).toBe(false);
    expect(canViewCoordinatorPedagogy("STUDENT")).toBe(false);
    expect(canViewCoordinatorPedagogy("ADMIN")).toBe(false);
  });
});
