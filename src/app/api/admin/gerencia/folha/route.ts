import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  buildPayrollLineSnapshot,
  referenceMonthFromYm,
  serializePayrollMonth,
  ymFromReferenceMonth,
} from "@/lib/payroll";
import { employeePositionText } from "@/lib/employees";
import { prisma } from "@/lib/prisma";
import { openPayrollMonthSchema } from "@/lib/validators/payroll";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const month = new URL(request.url).searchParams.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const referenceMonth = referenceMonthFromYm(month);
    const row = await prisma.payrollMonth.findUnique({
      where: { referenceMonth },
      include: { lines: { orderBy: [{ sortOrder: "asc" }, { employeeName: "asc" }] } },
    });
    if (!row) return jsonOk({ payroll: null });
    return jsonOk({ payroll: serializePayrollMonth(row) });
  }

  const list = await prisma.payrollMonth.findMany({
    orderBy: { referenceMonth: "desc" },
    take: 24,
    include: { lines: { select: { amountCents: true, offBooksPayCents: true, documentId: true } } },
  });

  return jsonOk({
    months: list.map((m) => ({
      id: m.id,
      referenceMonth: ymFromReferenceMonth(m.referenceMonth),
      status: m.status,
      responsibleName: m.responsibleName,
      lineCount: m.lines.length,
    })),
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = openPayrollMonthSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const referenceMonth = referenceMonthFromYm(parsed.data.month);
  const existing = await prisma.payrollMonth.findUnique({ where: { referenceMonth } });
  if (existing) {
    return jsonErr("DUPLICATE", "Já existe folha aberta para este mês.", 409);
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, status: { in: ["ATIVO", "AFASTADO"] } },
    orderBy: [{ employmentType: "asc" }, { name: "asc" }],
    include: { paymentAgreement: { select: { name: true } } },
  });

  const payroll = await prisma.$transaction(async (tx) => {
    const month = await tx.payrollMonth.create({
      data: {
        referenceMonth,
        responsibleName: parsed.data.responsibleName ?? null,
        notes: parsed.data.notes ?? null,
        createdByUserId: actor.id,
      },
    });

    if (employees.length) {
      await tx.payrollLine.createMany({
        data: employees.map((e, idx) => ({
          payrollMonthId: month.id,
          ...buildPayrollLineSnapshot(e, idx),
        })),
      });
    }

    const meal = await tx.mealTicketMonth.create({
      data: { payrollMonthId: month.id, createdByUserId: actor.id },
    });

    if (employees.length) {
      await tx.mealTicketLine.createMany({
        data: employees.map((e) => ({
          mealTicketMonthId: meal.id,
          employeeId: e.id,
          employeeName: e.name,
          positionLabel: employeePositionText(e),
        })),
      });
    }

    return tx.payrollMonth.findUniqueOrThrow({
      where: { id: month.id },
      include: { lines: { orderBy: [{ sortOrder: "asc" }, { employeeName: "asc" }] } },
    });
  });

  await createAuditLog({
    entityType: "PayrollMonth",
    entityId: payroll.id,
    action: "CREATE",
    diff: { month: parsed.data.month, lines: employees.length },
    performedByUserId: actor.id,
  });

  return jsonOk({ payroll: serializePayrollMonth(payroll) }, { status: 201 });
}
