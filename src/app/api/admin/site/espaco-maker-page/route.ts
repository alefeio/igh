import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
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
  const existing = await prisma.siteEspacoMakerPage.findFirst({ orderBy: { updatedAt: "desc" } });
  const previous = existing
    ? {
        title: existing.title,
        subtitle: existing.subtitle,
        content: existing.content,
        mediaUrls: existing.mediaUrls,
      }
    : null;
  if (await enqueueIfAdmin(user, "site_espaco_maker_page", "update", null, payload, previous)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
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
