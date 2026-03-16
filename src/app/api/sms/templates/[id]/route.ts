import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getSmsTemplate, updateSmsTemplate } from "@/lib/sms";
import { updateSmsTemplateSchema } from "@/lib/validators/sms";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const template = await getSmsTemplate(id);
  if (!template) return jsonErr("NOT_FOUND", "Template não encontrado.", 404);
  return jsonOk({ template });
}

export async function PUT(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = updateSmsTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const updated = await updateSmsTemplate(id, parsed.data);
  return jsonOk({ template: updated });
}
