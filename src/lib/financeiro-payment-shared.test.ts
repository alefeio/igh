import { describe, expect, it } from "vitest";

import {
  brazilTodayIsoDate,
  computeDueUrgency,
  daysUntilDueIso,
  isPastDueDate,
  resolveInitialPaymentStatusFromIso,
} from "@/lib/financeiro-payment-shared";

describe("financeiro-payment-shared", () => {
  it("marca vencimento futuro como em aberto (ok ou due_soon)", () => {
    expect(computeDueUrgency("EM_ABERTO", "2099-01-15", "2026-08-10")).toBe("ok");
    expect(computeDueUrgency("EM_ABERTO", "2026-08-15", "2026-08-10")).toBe("due_soon");
  });

  it("marca o dia do vencimento como due_today enquanto não pago", () => {
    expect(computeDueUrgency("EM_ABERTO", "2026-08-10", "2026-08-10")).toBe("due_today");
    expect(computeDueUrgency("PAGO", "2026-08-10", "2026-08-10")).toBe("ok");
  });

  it("marca após o vencimento como overdue se não pago", () => {
    expect(computeDueUrgency("PENDENTE", "2026-08-09", "2026-08-10")).toBe("overdue");
    expect(computeDueUrgency("EM_ABERTO", "2026-08-09", "2026-08-10")).toBe("overdue");
  });

  it("isPastDueDate só é true depois do dia do vencimento", () => {
    expect(isPastDueDate("2026-08-10", "2026-08-10")).toBe(false);
    expect(isPastDueDate("2026-08-09", "2026-08-10")).toBe(true);
    expect(daysUntilDueIso("2026-08-17", "2026-08-10")).toBe(7);
  });

  it("brazilTodayIsoDate retorna YYYY-MM-DD", () => {
    expect(brazilTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("resolveInitialPaymentStatusFromIso", () => {
  it("vencimento futuro ou hoje entra em aberto", () => {
    expect(
      resolveInitialPaymentStatusFromIso({ dueIso: "2026-08-20", alreadyPaid: false, todayIso: "2026-08-10" }),
    ).toEqual({ paymentStatus: "EM_ABERTO" });
    expect(
      resolveInitialPaymentStatusFromIso({ dueIso: "2026-08-10", alreadyPaid: true, todayIso: "2026-08-10" }),
    ).toEqual({ paymentStatus: "EM_ABERTO" });
  });

  it("vencimento passado usa a resposta do usuário", () => {
    expect(
      resolveInitialPaymentStatusFromIso({ dueIso: "2026-08-01", alreadyPaid: true, todayIso: "2026-08-10" }),
    ).toEqual({ paymentStatus: "PAGO" });
    expect(
      resolveInitialPaymentStatusFromIso({ dueIso: "2026-08-01", alreadyPaid: false, todayIso: "2026-08-10" }),
    ).toEqual({ paymentStatus: "PENDENTE" });
  });
});
