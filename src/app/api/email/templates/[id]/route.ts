import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  getEmailTemplate,
  updateEmailTemplate,
} from "@/lib/email-campaigns";
import { updateEmailTemplateSchema } from "@/lib/validators/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const template = await getEmailTemplate(id);
  if (!template)
    return jsonErr("NOT_FOUND", "Template não encontrado.", 404);
  return jsonOk({ template });
}

export async function PUT(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = updateEmailTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }
  const updated = await updateEmailTemplate(id, parsed.data);
  return jsonOk({ template: updated });
}
