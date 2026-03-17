import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createEmailTemplate, listEmailTemplates } from "@/lib/email-campaigns";
import { createEmailTemplateSchema } from "@/lib/validators/email-campaigns";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const activeOnly =
    new URL(request.url).searchParams.get("activeOnly") === "true";
  const items = await listEmailTemplates(activeOnly);
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = createEmailTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }
  const template = await createEmailTemplate({
    ...parsed.data,
    createdById: user.id,
  });
  return jsonOk({ template });
}
