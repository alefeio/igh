import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteAboutPageSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const row = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
  return jsonOk({ item: row });
}

export async function PATCH(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteAboutPageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const existing = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = {
    title: parsed.data.title ?? undefined,
    subtitle: parsed.data.subtitle ?? undefined,
    content: parsed.data.content ?? undefined,
  };
  const item = existing
    ? await prisma.siteAboutPage.update({ where: { id: existing.id }, data })
    : await prisma.siteAboutPage.create({
        data: {
          title: parsed.data.title ?? null,
          subtitle: parsed.data.subtitle ?? null,
          content: parsed.data.content ?? null,
        },
      });
  return jsonOk({ item });
}
