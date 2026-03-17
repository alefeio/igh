import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  getEmailCampaignDetails,
  updateEmailCampaign,
} from "@/lib/email-campaigns";
import { updateEmailCampaignSchema } from "@/lib/validators/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const campaign = await getEmailCampaignDetails(id);
  if (!campaign)
    return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);
  return jsonOk({ campaign });
}

export async function PUT(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = updateEmailCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }
  const data = parsed.data;
  const scheduledAt =
    data.scheduledAt !== undefined
      ? data.scheduledAt
        ? new Date(data.scheduledAt)
        : null
      : undefined;
  const updated = await updateEmailCampaign(id, {
    ...data,
    scheduledAt,
  });
  if (!updated) {
    return jsonErr(
      "NOT_FOUND",
      "Campanha não encontrada ou não pode ser editada.",
      404
    );
  }
  return jsonOk({ campaign: updated });
}
