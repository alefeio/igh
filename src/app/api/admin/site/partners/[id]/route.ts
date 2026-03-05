import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { sitePartnerSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = sitePartnerSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos", 400);
  const existing = await prisma.sitePartner.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Parceiro nao encontrado.", 404);
  const item = await prisma.sitePartner.update({
    where: { id },
    data: {
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl === "" ? null : (parsed.data.logoUrl ?? undefined),
      websiteUrl: parsed.data.websiteUrl === "" ? null : (parsed.data.websiteUrl ?? undefined),
      order: parsed.data.order ?? undefined,
      isActive: parsed.data.isActive ?? undefined,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.sitePartner.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Parceiro nao encontrado.", 404);
  await prisma.sitePartner.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
