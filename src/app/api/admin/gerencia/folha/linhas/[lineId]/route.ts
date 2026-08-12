import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { findFolhaSaidaCategoryId } from "@/lib/employee-portal";
import { formatReferenceMonth } from "@/lib/employees";
import { jsonErr, jsonOk } from "@/lib/http";
import { serializePayrollLine } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { updatePayrollLineSchema } from "@/lib/validators/payroll";

type Ctx = { params: Promise<{ lineId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { lineId } = await ctx.params;
  const existing = await prisma.payrollLine.findUnique({
    where: { id: lineId },
    include: { payrollMonth: { select: { id: true, status: true, referenceMonth: true } } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Linha da folha não encontrada.", 404);
  if (existing.payrollMonth.status === "FECHADA") {
    return jsonErr("CLOSED", "Folha fechada — reabra para editar.", 409);
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePayrollLineSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const amount =
    parsed.data.amount !== undefined && parsed.data.amount !== null
      ? parsed.data.amount
      : parsed.data.amountCents;
  const offBooks =
    parsed.data.offBooksPay !== undefined && parsed.data.offBooksPay !== null
      ? parsed.data.offBooksPay
      : parsed.data.offBooksPayCents;

  const nextAmountCents = amount !== undefined && amount !== null ? amount : existing.amountCents;
  const nextOffBooks =
    offBooks !== undefined && offBooks !== null ? offBooks : existing.offBooksPayCents;
  const paymentStatus = parsed.data.paymentStatus;

  const updated = await prisma.$transaction(async (tx) => {
    let financialEntryId = existing.financialEntryId;

    if (paymentStatus === "PAGO" && !financialEntryId) {
      const totalCents = nextAmountCents + nextOffBooks;
      if (totalCents > 0) {
        const categoryId = await findFolhaSaidaCategoryId();
        const entryDate = existing.payrollMonth.referenceMonth;
        const monthLabel = formatReferenceMonth(entryDate);
        const entry = await tx.financialEntry.create({
          data: {
            kind: "SAIDA",
            description: `Folha ${existing.employeeName} — ${monthLabel}`,
            amountCents: totalCents,
            entryDate,
            paymentStatus: "PAGO",
            paidAt: new Date(),
            categoryId,
            paymentMethod: "PIX",
            responsibleName: existing.employeeName,
            notes: existing.observation,
            createdByUserId: actor.id,
          },
          select: { id: true },
        });
        financialEntryId = entry.id;
      }
    }

    return tx.payrollLine.update({
      where: { id: lineId },
      data: {
        ...(amount !== undefined && amount !== null ? { amountCents: amount } : {}),
        ...(offBooks !== undefined && offBooks !== null ? { offBooksPayCents: offBooks } : {}),
        ...(parsed.data.observation !== undefined ? { observation: parsed.data.observation } : {}),
        ...(parsed.data.fundingChannel !== undefined
          ? { fundingChannel: parsed.data.fundingChannel }
          : {}),
        ...(parsed.data.fundingContractRef !== undefined
          ? { fundingContractRef: parsed.data.fundingContractRef }
          : {}),
        ...(paymentStatus !== undefined
          ? {
              paymentStatus,
              paidAt: paymentStatus === "PAGO" ? new Date() : null,
              ...(financialEntryId && financialEntryId !== existing.financialEntryId
                ? { financialEntryId }
                : {}),
            }
          : {}),
      },
    });
  });

  await createAuditLog({
    entityType: "PayrollLine",
    entityId: lineId,
    action: "UPDATE",
    diff: parsed.data,
    performedByUserId: actor.id,
  });

  return jsonOk({ line: serializePayrollLine(updated) });
}
