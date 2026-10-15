import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    fn();
  },
}));

const createAuditLog = vi.fn();
const sendEnrollmentCancellationEmail = vi.fn();
const sendEnrollmentSuspensionEmail = vi.fn();

vi.mock("@/lib/audit", () => ({ createAuditLog: (...args: unknown[]) => createAuditLog(...args) }));
vi.mock("@/lib/enrollment-suspension-email", () => ({
  sendEnrollmentCancellationEmail: (...args: unknown[]) => sendEnrollmentCancellationEmail(...args),
  sendEnrollmentSuspensionEmail: (...args: unknown[]) => sendEnrollmentSuspensionEmail(...args),
}));

const enrollmentFindFirst = vi.fn();
const enrollmentUpdate = vi.fn();
const classSessionFindMany = vi.fn();
const sessionAttendanceFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findFirst: (...args: unknown[]) => enrollmentFindFirst(...args),
      update: (...args: unknown[]) => enrollmentUpdate(...args),
    },
    classSession: {
      findMany: (...args: unknown[]) => classSessionFindMany(...args),
    },
    sessionAttendance: {
      findMany: (...args: unknown[]) => sessionAttendanceFindMany(...args),
    },
  },
}));

describe("applyAttendanceSuspensionRules — 4ª falta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuditLog.mockResolvedValue({});
    sendEnrollmentCancellationEmail.mockResolvedValue({ sent: true });
    enrollmentUpdate.mockResolvedValue({});
  });

  it("cancela matrícula suspensa sem matricular a lista de espera", async () => {
    enrollmentFindFirst.mockResolvedValue({
      id: "enr-susp",
      status: "SUSPENDED",
      student: { name: "Aluno Suspenso" },
    });
    classSessionFindMany.mockResolvedValue([
      { id: "s4" },
      { id: "s3" },
      { id: "s2" },
      { id: "s1" },
    ]);
    sessionAttendanceFindMany.mockResolvedValue([
      { classSessionId: "s4", present: false, absenceJustification: null },
      { classSessionId: "s3", present: false, absenceJustification: null },
      { classSessionId: "s2", present: false, absenceJustification: null },
      { classSessionId: "s1", present: false, absenceJustification: null },
    ]);
    createAuditLog.mockRejectedValue(new Error("audit indisponível"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { applyAttendanceSuspensionRules } = await import("@/lib/enrollment-attendance-suspension");

    const result = await applyAttendanceSuspensionRules({
      classGroupId: "cg-1",
      performedByUserId: "user-1",
      rows: [
        {
          enrollmentId: "enr-susp",
          present: false,
          absenceJustification: null,
          appliedMark: "F",
        },
      ],
    });

    expect(result.cancelledIds).toEqual(["enr-susp"]);
    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: "enr-susp" },
      data: { status: "CANCELLED" },
    });
    consoleError.mockRestore();
  });

  it("não cancela quando a grade marca a 4ª falta sem confirmação", async () => {
    enrollmentFindFirst.mockResolvedValue({
      id: "enr-susp",
      status: "SUSPENDED",
      student: { name: "Aluno Suspenso" },
    });
    classSessionFindMany.mockResolvedValue([{ id: "s4" }, { id: "s3" }, { id: "s2" }, { id: "s1" }]);
    sessionAttendanceFindMany.mockResolvedValue([
      { classSessionId: "s4", present: false, absenceJustification: null },
      { classSessionId: "s3", present: false, absenceJustification: null },
      { classSessionId: "s2", present: false, absenceJustification: null },
      { classSessionId: "s1", present: false, absenceJustification: null },
    ]);

    const { applyAttendanceSuspensionRules } = await import("@/lib/enrollment-attendance-suspension");
    const result = await applyAttendanceSuspensionRules({
      classGroupId: "cg-1",
      performedByUserId: "user-1",
      rows: [
        {
          enrollmentId: "enr-susp",
          present: false,
          absenceJustification: null,
          appliedMark: "F",
          confirmCancel: false,
        },
      ],
    });

    expect(result.cancelledIds).toEqual([]);
    expect(enrollmentUpdate).not.toHaveBeenCalled();
  });
});
