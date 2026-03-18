import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createEmailCampaign, listEmailCampaigns } from "@/lib/email-campaigns";
import { Prisma } from "@/generated/prisma/client";
import {
  createEmailCampaignSchema,
  listEmailCampaignsQuerySchema,
} from "@/lib/validators/email-campaigns";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const parsed = listEmailCampaignsQuerySchema.safeParse({
    page: page ?? undefined,
    pageSize: pageSize ?? undefined,
    status: status && status.trim() !== "" ? status : undefined,
    search: search && search.trim() !== "" ? search : undefined,
  });
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Parâmetros inválidos",
      400
    );
  }
  const result = await listEmailCampaigns(parsed.data);
  return jsonOk(result);
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = createEmailCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }
  const data = parsed.data;
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : undefined;
  try {
    const campaign = await createEmailCampaign({
      name: data.name,
      description: data.description ?? undefined,
      audienceType: data.audienceType,
      audienceFilters: data.audienceFilters ?? undefined,
      templateId: data.templateId ?? undefined,
      subject: data.subject ?? undefined,
      htmlContent: data.htmlContent ?? undefined,
      textContent: data.textContent ?? undefined,
      scheduledAt,
      createdById: user.id,
    });
    return jsonOk({ campaign });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientValidationError) {
      const hint =
        String(e.message).includes("audienceType") ||
        String(e.message).includes("SPECIFIC_STUDENTS")
          ? " Rode `npx prisma generate`, apague a pasta `.next` e reinicie o servidor. No servidor/banco: `npx prisma migrate deploy`."
          : "";
      return jsonErr(
        "PRISMA_VALIDATION",
        `Falha ao gravar a campanha (cliente Prisma desatualizado ou dados inválidos).${hint}`,
        400
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "22P02") {
      return jsonErr(
        "DB_ENUM",
        "O banco não reconhece este tipo de público. Execute as migrations: `npx prisma migrate deploy`.",
        400
      );
    }
    console.error("[POST /api/email/campaigns]", e);
    return jsonErr("INTERNAL_ERROR", "Erro ao criar campanha.", 500);
  }
}
