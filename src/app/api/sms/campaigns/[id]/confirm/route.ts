import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { confirmSmsCampaign } from "@/lib/sms";
import { confirmSmsCampaignSchema } from "@/lib/validators/sms";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = confirmSmsCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const result = await confirmSmsCampaign(
    id,
    parsed.data.messageContent,
    user.id,
    parsed.data.sendImmediately
  );
  if (!result) {
    return jsonErr("NOT_FOUND", "Campanha não encontrada ou não está em rascunho.", 404);
  }
  return jsonOk({ campaign: result });
}
