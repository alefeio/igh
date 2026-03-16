import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { cancelSmsCampaign } from "@/lib/sms";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const campaign = await cancelSmsCampaign(id, user.id);
  if (!campaign) {
    return jsonErr(
      "NOT_FOUND",
      "Campanha não encontrada ou não pode ser cancelada (apenas rascunho ou agendada antes do horário).",
      404
    );
  }
  return jsonOk({ campaign });
}
