import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteEspacoMakerPageSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const row = await prisma.siteEspacoMakerPage.findFirst({ orderBy: { updatedAt: "desc" } });
  return jsonOk({ item: row });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteEspacoMakerPageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const mediaUrls = (parsed.data.mediaUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  const payload = {
    title: parsed.data.title ?? null,
    subtitle: parsed.data.subtitle ?? null,
    content: parsed.data.content ?? null,
    mediaUrls,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_espaco_maker_page", "update", null, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  const existing = await prisma.siteEspacoMakerPage.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = {
    title: payload.title ?? undefined,
    subtitle: payload.subtitle ?? undefined,
    content: payload.content ?? undefined,
    mediaUrls: payload.mediaUrls,
  };
  const item = existing
    ? await prisma.siteEspacoMakerPage.update({ where: { id: existing.id }, data })
    : await prisma.siteEspacoMakerPage.create({ data: payload });
  return jsonOk({ item });
}
