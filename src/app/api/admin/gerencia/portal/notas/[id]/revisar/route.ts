import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  approveInvoiceSubmission,
  rejectInvoiceSubmission,
  serializeInvoiceSubmission,
} from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { reviewInvoiceSubmissionSchema } from "@/lib/validators/employee-portal";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = reviewInvoiceSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const row =
      parsed.data.action === "APROVAR"
        ? await approveInvoiceSubmission({
            submissionId: id,
            actorId: actor.id,
            reviewNotes: parsed.data.reviewNotes,
            createFinancialEntry: parsed.data.createFinancialEntry ?? true,
          })
        : await rejectInvoiceSubmission({
            submissionId: id,
            actorId: actor.id,
            reviewNotes: parsed.data.reviewNotes,
          });

    await createAuditLog({
      entityType: "EmployeeInvoiceSubmission",
      entityId: id,
      action: parsed.data.action === "APROVAR" ? "APPROVE" : "REJECT",
      diff: {
        createFinancialEntry: parsed.data.createFinancialEntry,
        reviewNotes: parsed.data.reviewNotes,
      },
      performedByUserId: actor.id,
    });

    return jsonOk({ submission: serializeInvoiceSubmission(row) });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return jsonErr("NOT_FOUND", "Envio não encontrado.", 404);
    }
    if (e instanceof Error && e.message === "ALREADY_REVIEWED") {
      return jsonErr("ALREADY_REVIEWED", "Esta nota já foi revisada.", 409);
    }
    if (e instanceof Error && e.message === "AMOUNT_REQUIRED") {
      return jsonErr(
        "AMOUNT_REQUIRED",
        "Informe o valor da nota antes de lançar no financeiro. Recuse e peça o reenvio, ou aprove sem lançar.",
        400,
      );
    }
    throw e;
  }
}
