import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteInscrevaPageSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const row = await prisma.siteInscrevaPage.findFirst({ orderBy: { updatedAt: "desc" } });
  return jsonOk({ item: row });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteInscrevaPageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const payload = {
    title: parsed.data.title ?? null,
    subtitle: parsed.data.subtitle ?? null,
    headerImageUrl: parsed.data.headerImageUrl?.trim() ? parsed.data.headerImageUrl.trim() : null,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_inscreva_page", "update", null, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  const existing = await prisma.siteInscrevaPage.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = {
    title: payload.title ?? undefined,
    subtitle: payload.subtitle ?? undefined,
    headerImageUrl: payload.headerImageUrl ?? undefined,
  };
  const item = existing
    ? await prisma.siteInscrevaPage.update({ where: { id: existing.id }, data })
    : await prisma.siteInscrevaPage.create({ data: payload });
  return jsonOk({ item });
}
