import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteAboutPageSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const row = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
  return jsonOk({ item: row });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteAboutPageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const payload = {
    title: parsed.data.title ?? null,
    subtitle: parsed.data.subtitle ?? null,
    content: parsed.data.content ?? null,
    imageUrl: parsed.data.imageUrl?.trim() ? parsed.data.imageUrl.trim() : null,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_about", "update", null, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  const existing = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = {
    title: payload.title ?? undefined,
    subtitle: payload.subtitle ?? undefined,
    content: payload.content ?? undefined,
    imageUrl: payload.imageUrl ?? undefined,
  };
  const item = existing
    ? await prisma.siteAboutPage.update({ where: { id: existing.id }, data })
    : await prisma.siteAboutPage.create({ data: payload });
  return jsonOk({ item });
}
