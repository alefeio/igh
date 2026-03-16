import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createSmsCampaign, listSmsCampaigns } from "@/lib/sms";
import { createSmsCampaignSchema, listSmsCampaignsQuerySchema } from "@/lib/validators/sms";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const parsed = listSmsCampaignsQuerySchema.safeParse({
    page: page ?? undefined,
    pageSize: pageSize ?? undefined,
    status: status && status.trim() !== "" ? status : undefined,
    search: search && search.trim() !== "" ? search : undefined,
  });
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Parâmetros inválidos", 400);
  }
  const result = await listSmsCampaigns(parsed.data);
  return jsonOk(result);
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = createSmsCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const data = parsed.data;
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : undefined;
  const campaign = await createSmsCampaign({
    name: data.name,
    description: data.description ?? undefined,
    audienceType: data.audienceType,
    audienceFilters: data.audienceFilters ?? undefined,
    templateId: data.templateId ?? undefined,
    messageContent: data.messageContent ?? undefined,
    scheduledAt,
    createdById: user.id,
  });
  return jsonOk({ campaign });
}
