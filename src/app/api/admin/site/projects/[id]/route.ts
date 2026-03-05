import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteProjectSchema } from "@/lib/validators/site";

export async function GET(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER"]);
  const item = await prisma.siteProject.findUnique({ where: { id: (await ctx.params).id } });
  if (!item) return jsonErr("NOT_FOUND", "Projeto nao encontrado.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteProjectSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const existing = await prisma.siteProject.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Projeto nao encontrado.", 404);
  const slugVal = parsed.data.slug || parsed.data.title.toLowerCase().replace(/\s+/g, "-");
  const payload = {
    title: parsed.data.title,
    slug: slugVal,
    summary: parsed.data.summary ?? undefined,
    content: parsed.data.content ?? undefined,
    coverImageUrl: parsed.data.coverImageUrl === "" ? null : parsed.data.coverImageUrl ?? undefined,
    galleryImages: parsed.data.galleryImages ?? undefined,
    order: parsed.data.order ?? undefined,
    isActive: parsed.data.isActive ?? undefined,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_project", "update", id, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  const item = await prisma.siteProject.update({ where: { id }, data: payload });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteProject.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Projeto nao encontrado.", 404);
  await prisma.siteProject.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
