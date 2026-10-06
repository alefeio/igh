import { describe, expect, it } from "vitest";

import { classifyEnrollment, countConsecutiveAbsences } from "@/lib/coordinator/classify";
import { buildIndicators, weeklyAttendance } from "@/lib/coordinator/indicators";
import type { EnrollmentSignalInput } from "@/lib/coordinator/types";

function row(partial: Partial<EnrollmentSignalInput> & Pick<EnrollmentSignalInput, "id" | "status">): EnrollmentSignalInput {
  return {
    studentName: partial.id,
    isPreEnrollment: false,
    confirmed: true,
    heldSessions: 8,
    presentCount: 0,
    consecutiveAbsences: 0,
    progressPercent: null,
    lmsInactiveDays: null,
    scorePercent: null,
    classClosed: false,
    ...partial,
  };
}

describe("coordenação pedagógica", () => {
  it("não trata pré-matrícula sem confirmação como evasão", () => {
    const result = classifyEnrollment(
      row({ id: "pre", status: "ACTIVE", isPreEnrollment: true, confirmed: false, presentCount: 0 }),
    );
    expect(result.kind).toBe("PRE_ENROLLMENT");
    expect(result.inAcademicCohort).toBe(false);
    const report = buildIndicators([
      row({ id: "pre", status: "ACTIVE", isPreEnrollment: true, confirmed: false }),
    ]);
    expect(report.indicators.dropoutRate.available).toBe(false);
    expect(report.indicators.dropoutRate.value).toBeNull();
  });

  it("separa no-show, abandono precoce, evasão e conclusão", () => {
    const report = buildIndicators([
      row({ id: "espera", status: "ACTIVE", heldSessions: 0, presentCount: 0 }),
      row({ id: "noshow", status: "CANCELLED", heldSessions: 4, presentCount: 0 }),
      row({ id: "cedo", status: "CANCELLED", heldSessions: 8, presentCount: 1 }),
      row({ id: "saiu", status: "CANCELLED", heldSessions: 8, presentCount: 5 }),
      row({ id: "fim", status: "COMPLETED", presentCount: 8 }),
      row({ id: "ativo", status: "ACTIVE", presentCount: 7, consecutiveAbsences: 0 }),
    ]);
    expect(report.counts.noShow).toBe(1);
    expect(report.counts.earlyDropout).toBe(1);
    expect(report.counts.dropout).toBe(1);
    expect(report.counts.completed).toBe(1);
    expect(report.indicators.dropoutRate.value).toBe(50);
    expect(report.indicators.completionRate.value).toBe(25);
  });

  it("não conta cancelamento administrativo nem transferência como evasão", () => {
    const admin = classifyEnrollment(row({ id: "adm", status: "CANCELLED", recordedReason: "ADMINISTRATIVE", presentCount: 4 }));
    const moved = classifyEnrollment(row({ id: "tr", status: "CANCELLED", recordedReason: "TRANSFER", presentCount: 4 }));
    expect(admin.kind).toBe("CANCELLED_ADMIN");
    expect(moved.kind).toBe("TRANSFERRED");
    const report = buildIndicators([
      row({ id: "adm", status: "CANCELLED", recordedReason: "ADMINISTRATIVE", presentCount: 4 }),
      row({ id: "tr", status: "CANCELLED", recordedReason: "TRANSFER", presentCount: 4 }),
      row({ id: "ficou", status: "ACTIVE", presentCount: 6 }),
    ]);
    expect(report.counts.dropout).toBe(0);
    expect(report.counts.earlyDropout).toBe(0);
  });

  it("mantém suspensão fora da evasão e explica o risco", () => {
    const suspended = classifyEnrollment(
      row({ id: "sus", status: "SUSPENDED", presentCount: 3, consecutiveAbsences: 2 }),
    );
    expect(suspended.kind).toBe("SUSPENDED");
    expect(suspended.riskReasons.join(" ")).toMatch(/suspensa/i);
    expect(suspended.riskReasons.join(" ")).toMatch(/faltas consecutivas/);
  });

  it("explica risco por frequência, faltas e ausência de acesso", () => {
    const student = classifyEnrollment(
      row({
        id: "maria",
        studentName: "Maria Silva",
        status: "ACTIVE",
        presentCount: 4,
        heldSessions: 8,
        consecutiveAbsences: 2,
        lmsInactiveDays: 9,
      }),
    );
    expect(student.riskLevel).toBe("WARNING");
    expect(student.attendancePercent).toBe(50);
    expect(student.riskReasons.some((reason) => reason.includes("68%") || reason.includes("50%"))).toBe(true);
    expect(student.riskReasons.some((reason) => reason.includes("2 faltas"))).toBe(true);
    expect(student.riskReasons.some((reason) => reason.includes("9 dias"))).toBe(true);
  });

  it("não inventa frequência quando não houve aula", () => {
    const waiting = classifyEnrollment(row({ id: "nova", status: "ACTIVE", heldSessions: 0, presentCount: 0, classClosed: false }));
    expect(waiting.kind).toBe("CONFIRMED_WAITING_CLASS");
    expect(waiting.attendancePercent).toBeNull();
    const report = buildIndicators([row({ id: "nova", status: "ACTIVE", heldSessions: 0, presentCount: 0 })]);
    expect(report.indicators.attendanceRate.available).toBe(false);
    expect(report.indicators.attendanceRate.value).toBeNull();
  });

  it("mede retenção pelos marcos de quem começou", () => {
    const report = buildIndicators([
      row({ id: "a", status: "ACTIVE", heldSessions: 8, presentCount: 2 }),
      row({ id: "b", status: "ACTIVE", heldSessions: 8, presentCount: 4 }),
      row({ id: "c", status: "ACTIVE", heldSessions: 8, presentCount: 6 }),
      row({ id: "d", status: "COMPLETED", heldSessions: 8, presentCount: 8 }),
      row({ id: "pre", status: "ACTIVE", isPreEnrollment: true, confirmed: false, presentCount: 0 }),
    ]);
    expect(report.retention[0]).toMatchObject({ label: "No início (já frequentaram)", count: 4 });
    expect(report.retention.find((point) => point.mark === 25)?.count).toBe(4);
    expect(report.retention.find((point) => point.mark === 50)?.count).toBe(3);
    expect(report.retention.find((point) => point.mark === 75)?.count).toBe(2);
    expect(report.retention.find((point) => point.mark === 100)?.count).toBe(1);
  });

  it("ignora chamada ainda não lançada ao contar faltas consecutivas", () => {
    expect(
      countConsecutiveAbsences([
        { date: "2026-01-01", present: true },
        { date: "2026-01-08", present: false },
        { date: "2026-01-15", present: null },
        { date: "2026-01-22", present: false },
      ]),
    ).toBe(2);
    expect(countConsecutiveAbsences([])).toBe(0);
  });

  it("não calcula percentual semanal sem chamada", () => {
    expect(weeklyAttendance([{ week: "Semana 1", present: 0, marked: 0 }])).toEqual([
      { week: "Semana 1", percent: null },
    ]);
  });

  it("turma encerrada sem presença confirmada é no-show, não evasão", () => {
    const closed = classifyEnrollment(
      row({ id: "fechada", status: "ACTIVE", heldSessions: 6, presentCount: 0, classClosed: true }),
    );
    expect(closed.kind).toBe("NO_SHOW");
    const report = buildIndicators([
      row({ id: "fechada", status: "ACTIVE", heldSessions: 6, presentCount: 0, classClosed: true }),
    ]);
    expect(report.counts.dropout).toBe(0);
    expect(report.counts.noShow).toBe(1);
  });
});
