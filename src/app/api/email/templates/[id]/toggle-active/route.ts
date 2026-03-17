import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { toggleEmailTemplateActive } from "@/lib/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const template = await toggleEmailTemplateActive(id);
  if (!template)
    return jsonErr("NOT_FOUND", "Template não encontrado.", 404);
  return jsonOk({ template });
}
