import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { sitePartnerSchema } from "@/lib/validators/site";

type RouteCtx = { params: Promise<{ id: string }> };

function cleanUrlOrNull(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s ? s : null;
}

export async function GET(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const item = await prisma.sitePartner.findUnique({ where: { id } });
  if (!item) return jsonErr("NOT_FOUND", "Parceiro não encontrado.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const existing = await prisma.sitePartner.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Parceiro não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = sitePartnerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  }

  const data: Record<string, unknown> = {};
  if (typeof parsed.data.name === "string") data.name = parsed.data.name.trim();
  if ("logoUrl" in parsed.data) data.logoUrl = cleanUrlOrNull(parsed.data.logoUrl);
  if ("websiteUrl" in parsed.data) data.websiteUrl = cleanUrlOrNull(parsed.data.websiteUrl);
  if (typeof parsed.data.order === "number") data.order = parsed.data.order;
  if (typeof parsed.data.isActive === "boolean") data.isActive = parsed.data.isActive;

  if (typeof data.name === "string" && !String(data.name).trim()) {
    return jsonErr("VALIDATION_ERROR", "Nome é obrigatório", 400);
  }

  const item = await prisma.sitePartner.update({
    where: { id },
    data: data as never,
  });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const existing = await prisma.sitePartner.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Parceiro não encontrado.", 404);

  await prisma.sitePartner.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
