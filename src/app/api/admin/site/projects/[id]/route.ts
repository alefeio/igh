import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteProjectSchema } from "@/lib/validators/site";

function projectPrevious(existing: {
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  order: number;
  isActive: boolean;
}) {
  return {
    title: existing.title,
    slug: existing.slug,
    summary: existing.summary,
    content: existing.content,
    coverImageUrl: existing.coverImageUrl,
    galleryImages: existing.galleryImages,
    order: existing.order,
    isActive: existing.isActive,
  };
}

export async function GET(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const item = await prisma.siteProject.findUnique({ where: { id: (await ctx.params).id } });
  if (!item) return jsonErr("NOT_FOUND", "Projeto nao encontrado.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
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
  if (await enqueueIfAdmin(user, "site_project", "update", id, payload, projectPrevious(existing))) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  const item = await prisma.siteProject.update({ where: { id }, data: payload });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteProject.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Projeto nao encontrado.", 404);
  if (await enqueueIfAdmin(user, "site_project", "delete", id, {}, projectPrevious(existing))) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.siteProject.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
