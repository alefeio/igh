import "server-only";

import type { EmploymentType } from "@/generated/prisma/client";
import { formatReferenceMonth, referenceMonthToDate } from "@/lib/employees";
import { listAdminManagerUserIds } from "@/lib/employee-portal";
import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

/** Dias antes do fim do mês para começar o aviso “prazo chegando”. */
export const EMPLOYEE_INVOICE_DUE_SOON_DAYS = 7;

const INVOICE_EMPLOYMENT_TYPES: EmploymentType[] = ["MEI", "PRESTADOR"];

export type InvoiceDuePhase = "OK" | "SOON" | "TODAY" | "OVERDUE" | "NOT_REQUIRED";

export type InvoiceDueStatus = {
  required: boolean;
  referenceMonth: string;
  referenceMonthLabel: string;
  dueDateIso: string;
  phase: InvoiceDuePhase;
  hasSubmission: boolean;
  delivered: boolean;
  message: string | null;
};

function padMonth(year: number, monthIndex0: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

/** Último dia do mês (UTC date-only) a partir de YYYY-MM. */
export function lastDayOfReferenceMonth(yyyyMm: string): Date | null {
  const first = referenceMonthToDate(yyyyMm);
  if (!first) return null;
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0));
}

export function employeeRequiresMonthlyInvoice(input: {
  status: string;
  employmentType: EmploymentType | string;
}): boolean {
  if (input.status !== "ATIVO") return false;
  return INVOICE_EMPLOYMENT_TYPES.includes(input.employmentType as EmploymentType);
}

export async function employeeHasInvoiceCoverage(employeeId: string, referenceMonth: Date) {
  const [delivered, submitted] = await Promise.all([
    prisma.employeeMonthlyInvoice.findFirst({
      where: {
        employeeId,
        referenceMonth,
        deletedAt: null,
        status: "ENTREGUE",
      },
      select: { id: true },
    }),
    prisma.employeeInvoiceSubmission.findFirst({
      where: {
        employeeId,
        referenceMonth,
        status: { in: ["PENDENTE", "APROVADA"] },
      },
      select: { id: true },
    }),
  ]);
  return {
    delivered: !!delivered,
    hasSubmission: !!submitted || !!delivered,
    covered: !!delivered || !!submitted,
  };
}

export async function getEmployeeInvoiceDueStatus(
  employeeId: string,
  opts?: { employmentType?: EmploymentType | string; status?: string; today?: Date },
): Promise<InvoiceDueStatus> {
  const today = opts?.today ?? getBrazilTodayDateOnly();
  const yyyyMm = padMonth(today.getUTCFullYear(), today.getUTCMonth());
  const due = lastDayOfReferenceMonth(yyyyMm)!;
  const dueDateIso = due.toISOString().slice(0, 10);
  const referenceMonthLabel = formatReferenceMonth(referenceMonthToDate(yyyyMm)!);

  if (opts?.employmentType != null && opts.status != null) {
    if (!employeeRequiresMonthlyInvoice({ status: opts.status, employmentType: opts.employmentType })) {
      return {
        required: false,
        referenceMonth: yyyyMm,
        referenceMonthLabel,
        dueDateIso,
        phase: "NOT_REQUIRED",
        hasSubmission: false,
        delivered: false,
        message: null,
      };
    }
  } else {
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { status: true, employmentType: true },
    });
    if (
      !emp ||
      !employeeRequiresMonthlyInvoice({ status: emp.status, employmentType: emp.employmentType })
    ) {
      return {
        required: false,
        referenceMonth: yyyyMm,
        referenceMonthLabel,
        dueDateIso,
        phase: "NOT_REQUIRED",
        hasSubmission: false,
        delivered: false,
        message: null,
      };
    }
  }

  const monthDate = referenceMonthToDate(yyyyMm)!;
  const coverage = await employeeHasInvoiceCoverage(employeeId, monthDate);
  if (coverage.covered) {
    return {
      required: true,
      referenceMonth: yyyyMm,
      referenceMonthLabel,
      dueDateIso,
      phase: "OK",
      hasSubmission: coverage.hasSubmission,
      delivered: coverage.delivered,
      message: coverage.delivered
        ? `Nota de ${referenceMonthLabel} já entregue.`
        : `Nota de ${referenceMonthLabel} enviada e em análise.`,
    };
  }

  const todayMs = today.getTime();
  const dueMs = due.getTime();
  const daysLeft = Math.round((dueMs - todayMs) / 86_400_000);

  if (daysLeft < 0) {
    return {
      required: true,
      referenceMonth: yyyyMm,
      referenceMonthLabel,
      dueDateIso,
      phase: "OVERDUE",
      hasSubmission: false,
      delivered: false,
      message: `Nota de ${referenceMonthLabel} pendente (prazo era ${dueDateIso.slice(8, 10)}/${dueDateIso.slice(5, 7)}).`,
    };
  }
  if (daysLeft === 0) {
    return {
      required: true,
      referenceMonth: yyyyMm,
      referenceMonthLabel,
      dueDateIso,
      phase: "TODAY",
      hasSubmission: false,
      delivered: false,
      message: `Hoje é o último dia para enviar a nota de ${referenceMonthLabel}.`,
    };
  }
  if (daysLeft <= EMPLOYEE_INVOICE_DUE_SOON_DAYS) {
    return {
      required: true,
      referenceMonth: yyyyMm,
      referenceMonthLabel,
      dueDateIso,
      phase: "SOON",
      hasSubmission: false,
      delivered: false,
      message: `Faltam ${daysLeft} dia(s) para o prazo da nota de ${referenceMonthLabel} (até o fim do mês).`,
    };
  }
  return {
    required: true,
    referenceMonth: yyyyMm,
    referenceMonthLabel,
    dueDateIso,
    phase: "OK",
    hasSubmission: false,
    delivered: false,
    message: `Envie a nota de ${referenceMonthLabel} até o fim do mês (${dueDateIso.slice(8, 10)}/${dueDateIso.slice(5, 7)}).`,
  };
}

async function ensureMonthlyStub(employeeId: string, referenceMonth: Date, status: "PENDENTE" | "ATRASADA") {
  await prisma.employeeMonthlyInvoice.upsert({
    where: { employeeId_referenceMonth: { employeeId, referenceMonth } },
    create: {
      employeeId,
      referenceMonth,
      status,
    },
    update: {
      deletedAt: null,
      ...(status === "ATRASADA"
        ? { status: "ATRASADA" }
        : {}),
    },
  });
}

/**
 * Garante stubs mensais, marca atrasadas e dispara notificações in-app
 * (colaborador + gerência) para prazo chegando / no dia / pendente.
 */
export async function ensureEmployeeInvoiceDueReminders(today = getBrazilTodayDateOnly()) {
  const dayKey = today.toISOString().slice(0, 10);
  const currentYm = padMonth(today.getUTCFullYear(), today.getUTCMonth());
  const currentMonthDate = referenceMonthToDate(currentYm)!;
  const currentDue = lastDayOfReferenceMonth(currentYm)!;
  const daysLeft = Math.round((currentDue.getTime() - today.getTime()) / 86_400_000);

  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const prevYm = padMonth(prev.getUTCFullYear(), prev.getUTCMonth());
  const prevMonthDate = referenceMonthToDate(prevYm)!;

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      status: "ATIVO",
      employmentType: { in: INVOICE_EMPLOYMENT_TYPES },
    },
    select: {
      id: true,
      name: true,
      userId: true,
      employmentType: true,
      status: true,
    },
  });

  const soon: { id: string; name: string; userId: string | null }[] = [];
  const dueToday: { id: string; name: string; userId: string | null }[] = [];
  const overdue: { id: string; name: string; userId: string | null; month: string }[] = [];

  for (const emp of employees) {
    await ensureMonthlyStub(emp.id, currentMonthDate, "PENDENTE");

    const currentCov = await employeeHasInvoiceCoverage(emp.id, currentMonthDate);
    if (!currentCov.covered) {
      if (daysLeft === 0) dueToday.push(emp);
      else if (daysLeft > 0 && daysLeft <= EMPLOYEE_INVOICE_DUE_SOON_DAYS) soon.push(emp);
    } else if (currentCov.delivered) {
      // já ok
    }

    // Mês anterior sem entrega após virar o mês → atrasada + alerta pendente
    if (today.getUTCDate() >= 1) {
      const prevCov = await employeeHasInvoiceCoverage(emp.id, prevMonthDate);
      if (!prevCov.covered) {
        await ensureMonthlyStub(emp.id, prevMonthDate, "ATRASADA");
        overdue.push({ ...emp, month: prevYm });
      } else if (!prevCov.delivered && prevCov.hasSubmission) {
        // Em análise: não marcar ATRASADA agressivamente
      }
    }
  }

  for (const emp of soon) {
    if (!emp.userId) continue;
    await createUserNotificationIfNew({
      userId: emp.userId,
      kind: "EMPLOYEE_INVOICE_DUE_REMINDER",
      title: "Prazo da nota fiscal se aproximando",
      body: `Faltam ${daysLeft} dia(s) para enviar a NF de ${formatReferenceMonth(currentMonthDate)}. Prazo: fim do mês.`,
      linkUrl: "/colaborador/notas",
      dedupeKey: `emp-inv-soon:${emp.id}:${currentYm}:${dayKey}`,
    });
  }

  for (const emp of dueToday) {
    if (!emp.userId) continue;
    await createUserNotificationIfNew({
      userId: emp.userId,
      kind: "EMPLOYEE_INVOICE_DUE_REMINDER",
      title: "Hoje vence o prazo da nota fiscal",
      body: `Envie a NF de ${formatReferenceMonth(currentMonthDate)} ainda hoje pelo portal.`,
      linkUrl: "/colaborador/notas",
      dedupeKey: `emp-inv-today:${emp.id}:${currentYm}:${dayKey}`,
    });
  }

  for (const emp of overdue) {
    if (!emp.userId) continue;
    await createUserNotificationIfNew({
      userId: emp.userId,
      kind: "EMPLOYEE_INVOICE_DUE_REMINDER",
      title: "Nota fiscal pendente",
      body: `A NF de ${formatReferenceMonth(referenceMonthToDate(emp.month)!)} ainda não foi enviada. Regularize pelo portal.`,
      linkUrl: "/colaborador/notas",
      dedupeKey: `emp-inv-overdue:${emp.id}:${emp.month}:${dayKey}`,
    });
  }

  const managers = await listAdminManagerUserIds();
  if (managers.length === 0) {
    return {
      employees: employees.length,
      soon: soon.length,
      dueToday: dueToday.length,
      overdue: overdue.length,
      managersNotified: 0,
    };
  }

  const linkUrl = "/admin/gerencia/portal";
  const notifyManagers = async (dedupeSuffix: string, title: string, body: string) => {
    await Promise.all(
      managers.map((userId) =>
        createUserNotificationIfNew({
          userId,
          kind: "EMPLOYEE_INVOICE_DUE_REMINDER",
          title,
          body,
          linkUrl,
          dedupeKey: `emp-inv-mgr:${dedupeSuffix}:${dayKey}:${userId}`,
        }),
      ),
    );
  };

  if (soon.length > 0) {
    await notifyManagers(
      `soon:${currentYm}`,
      "NFs com prazo se aproximando",
      `${soon.length} colaborador(es) ainda não enviaram a nota de ${formatReferenceMonth(currentMonthDate)} (vence em até ${EMPLOYEE_INVOICE_DUE_SOON_DAYS} dias).`,
    );
  }
  if (dueToday.length > 0) {
    await notifyManagers(
      `today:${currentYm}`,
      "NFs vencem hoje",
      `${dueToday.length} colaborador(es) precisam enviar a nota de ${formatReferenceMonth(currentMonthDate)} hoje.`,
    );
  }
  if (overdue.length > 0) {
    const names = overdue
      .slice(0, 8)
      .map((e) => e.name)
      .join(", ");
    await notifyManagers(
      `overdue:${prevYm}`,
      "NFs pendentes (mês anterior)",
      `${overdue.length} colaborador(es) sem NF de ${formatReferenceMonth(prevMonthDate)}${names ? `: ${names}` : ""}${overdue.length > 8 ? "…" : ""}.`,
    );
  }

  return {
    employees: employees.length,
    soon: soon.length,
    dueToday: dueToday.length,
    overdue: overdue.length,
    managersNotified: managers.length,
  };
}
