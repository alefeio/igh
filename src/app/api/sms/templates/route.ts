import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { listSmsTemplates, createSmsTemplate } from "@/lib/sms";
import { createSmsTemplateSchema } from "@/lib/validators/sms";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const items = await listSmsTemplates(activeOnly);
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = createSmsTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const data = parsed.data;
  const template = await createSmsTemplate({
    name: data.name,
    description: data.description ?? undefined,
    categoryHint: data.categoryHint ?? undefined,
    content: data.content,
    active: data.active ?? true,
    createdById: user.id,
  });
  return jsonOk({ template });
}
