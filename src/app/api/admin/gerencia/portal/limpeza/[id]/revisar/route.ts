import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { markCleaningReportSeen, serializeCleaningReport } from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { reviewPortalItemSchema } from "@/lib/validators/employee-portal";

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
  const parsed = reviewPortalItemSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const row = await markCleaningReportSeen({
      reportId: id,
      actorId: actor.id,
      reviewNotes: parsed.data.reviewNotes,
    });

    await createAuditLog({
      entityType: "EmployeeCleaningReport",
      entityId: id,
      action: "REVIEW",
      diff: { reviewNotes: parsed.data.reviewNotes },
      performedByUserId: actor.id,
    });

    return jsonOk({ report: serializeCleaningReport(row) });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return jsonErr("NOT_FOUND", "Relato não encontrado.", 404);
    }
    if (e instanceof Error && e.message === "ALREADY_REVIEWED") {
      return jsonErr("ALREADY_REVIEWED", "Este relato já foi marcado como visto.", 409);
    }
    throw e;
  }
}
