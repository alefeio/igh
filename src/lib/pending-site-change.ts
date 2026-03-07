import "server-only";

import { prisma } from "@/lib/prisma";

export type PendingChangeEntityType =
  | "site_settings"
  | "site_about"
  | "site_menu"
  | "site_menu_item"
  | "site_banner"
  | "site_project"
  | "site_project_reorder"
  | "site_testimonial"
  | "site_partner"
  | "site_news_category"
  | "site_news_post"
  | "site_faq_item"
  | "site_transparency_category"
  | "site_transparency_document"
  | "site_formation"
  | "site_formation_courses"
  | "site_formacoes_page"
  | "site_inscreva_page"
  | "site_contato_page";

export async function createPendingSiteChange(
  requestedByUserId: string,
  entityType: PendingChangeEntityType,
  action: "create" | "update",
  entityId: string | null,
  payload: Record<string, unknown>
) {
  return prisma.pendingSiteChange.create({
    data: {
      requestedByUserId,
      entityType,
      action,
      entityId,
      payload: payload as object,
      status: "pending",
    },
  });
}

export async function listPendingSiteChanges() {
  return prisma.pendingSiteChange.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getPendingSiteChange(id: string) {
  return prisma.pendingSiteChange.findUnique({
    where: { id, status: "pending" },
    include: { requestedBy: { select: { name: true, email: true } } },
  });
}

export async function rejectPendingSiteChange(id: string, reviewedByUserId: string) {
  return prisma.pendingSiteChange.update({
    where: { id },
    data: { status: "rejected", reviewedByUserId, reviewedAt: new Date() },
  });
}

export async function approvePendingSiteChange(id: string, reviewedByUserId: string) {
  const pending = await getPendingSiteChange(id);
  if (!pending) return null;
  await applyPendingChange(pending);
  return prisma.pendingSiteChange.update({
    where: { id },
    data: { status: "approved", reviewedByUserId, reviewedAt: new Date() },
  });
}

function cleanEmptyStrings(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" || v === undefined ? null : v;
  }
  return out;
}

async function applyPendingChange(pending: {
  entityType: string;
  action: string;
  entityId: string | null;
  payload: unknown;
}) {
  const payload = (pending.payload || {}) as Record<string, unknown>;
  const { entityType, action, entityId } = pending;

  switch (entityType) {
    case "site_settings": {
      const clean = cleanEmptyStrings(payload);
      let settings = await prisma.siteSettings.findFirst();
      if (!settings) {
        await prisma.siteSettings.create({ data: clean as never });
      } else {
        await prisma.siteSettings.update({ where: { id: settings.id }, data: clean as never });
      }
      return;
    }
    case "site_about": {
      const data = {
        title: payload.title ?? undefined,
        subtitle: payload.subtitle ?? undefined,
        content: payload.content ?? undefined,
        imageUrl: payload.imageUrl ?? undefined,
      };
      const existing = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
      if (existing) {
        await prisma.siteAboutPage.update({ where: { id: existing.id }, data });
      } else {
        await prisma.siteAboutPage.create({
          data: {
            title: (payload.title as string) ?? null,
            subtitle: (payload.subtitle as string) ?? null,
            content: (payload.content as string) ?? null,
            imageUrl: (payload.imageUrl as string) ?? null,
          },
        });
      }
      return;
    }
    case "site_formacoes_page": {
      const data = {
        title: payload.title ?? undefined,
        subtitle: payload.subtitle ?? undefined,
        headerImageUrl: payload.headerImageUrl ?? undefined,
      };
      const existing = await prisma.siteFormacoesPage.findFirst({ orderBy: { updatedAt: "desc" } });
      if (existing) {
        await prisma.siteFormacoesPage.update({ where: { id: existing.id }, data });
      } else {
        await prisma.siteFormacoesPage.create({
          data: {
            title: (payload.title as string) ?? null,
            subtitle: (payload.subtitle as string) ?? null,
            headerImageUrl: (payload.headerImageUrl as string) ?? null,
          },
        });
      }
      return;
    }
    case "site_inscreva_page": {
      const data = {
        title: payload.title ?? undefined,
        subtitle: payload.subtitle ?? undefined,
        headerImageUrl: payload.headerImageUrl ?? undefined,
      };
      const existing = await prisma.siteInscrevaPage.findFirst({ orderBy: { updatedAt: "desc" } });
      if (existing) {
        await prisma.siteInscrevaPage.update({ where: { id: existing.id }, data });
      } else {
        await prisma.siteInscrevaPage.create({
          data: {
            title: (payload.title as string) ?? null,
            subtitle: (payload.subtitle as string) ?? null,
            headerImageUrl: (payload.headerImageUrl as string) ?? null,
          },
        });
      }
      return;
    }
    case "site_contato_page": {
      const data = {
        title: payload.title ?? undefined,
        subtitle: payload.subtitle ?? undefined,
        headerImageUrl: payload.headerImageUrl ?? undefined,
      };
      const existing = await prisma.siteContatoPage.findFirst({ orderBy: { updatedAt: "desc" } });
      if (existing) {
        await prisma.siteContatoPage.update({ where: { id: existing.id }, data });
      } else {
        await prisma.siteContatoPage.create({
          data: {
            title: (payload.title as string) ?? null,
            subtitle: (payload.subtitle as string) ?? null,
            headerImageUrl: (payload.headerImageUrl as string) ?? null,
          },
        });
      }
      return;
    }
    case "site_banner":
      if (Array.isArray(payload.ids)) {
        const ids = payload.ids as string[];
        await prisma.$transaction(
          ids.map((id, index) => prisma.siteBanner.update({ where: { id }, data: { order: index } }))
        );
      } else if (action === "create") {
        const maxOrder = await prisma.siteBanner.aggregate({ _max: { order: true } });
        await prisma.siteBanner.create({
          data: {
            title: (payload.title as string) ?? null,
            subtitle: (payload.subtitle as string) ?? null,
            ctaLabel: (payload.ctaLabel as string) ?? null,
            ctaHref: (payload.ctaHref as string) ?? null,
            imageUrl: (payload.imageUrl as string) || null,
            order: (payload.order as number) ?? (maxOrder._max.order ?? -1) + 1,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteBanner.update({
          where: { id: entityId },
          data: {
            title: payload.title ?? undefined,
            subtitle: payload.subtitle ?? undefined,
            ctaLabel: payload.ctaLabel ?? undefined,
            ctaHref: payload.ctaHref ?? undefined,
            imageUrl: payload.imageUrl === "" ? null : (payload.imageUrl ?? undefined),
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_menu_item":
      if (action === "create") {
        await prisma.siteMenuItem.create({
          data: {
            label: payload.label as string,
            href: payload.href as string,
            order: (payload.order as number) ?? 0,
            parentId: (payload.parentId as string) || null,
            isExternal: !!payload.isExternal,
            isVisible: payload.isVisible !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteMenuItem.update({
          where: { id: entityId },
          data: {
            label: payload.label ?? undefined,
            href: payload.href ?? undefined,
            order: payload.order ?? undefined,
            parentId: payload.parentId === "" ? null : (payload.parentId ?? undefined),
            isExternal: payload.isExternal ?? undefined,
            isVisible: payload.isVisible ?? undefined,
          } as never,
        });
      }
      return;
    case "site_project":
      if (action === "create") {
        const slug = ((payload.slug as string) || (payload.title as string)?.toLowerCase?.()?.replace?.(/\s+/g, "-")) ?? "";
        await prisma.siteProject.create({
          data: {
            title: payload.title as string,
            slug,
            summary: (payload.summary as string) ?? null,
            content: (payload.content as string) ?? null,
            coverImageUrl: (payload.coverImageUrl as string) || null,
            galleryImages: (payload.galleryImages as string[]) ?? [],
            order: (payload.order as number) ?? 0,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        const slugVal = (payload.slug as string) || (payload.title as string)?.toLowerCase?.()?.replace?.(/\s+/g, "-");
        await prisma.siteProject.update({
          where: { id: entityId },
          data: {
            title: payload.title ?? undefined,
            slug: slugVal ?? undefined,
            summary: payload.summary ?? undefined,
            content: payload.content ?? undefined,
            coverImageUrl: payload.coverImageUrl === "" ? null : (payload.coverImageUrl ?? undefined),
            galleryImages: payload.galleryImages ?? undefined,
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_testimonial":
      if (action === "create") {
        await prisma.siteTestimonial.create({
          data: {
            name: payload.name as string,
            roleOrContext: (payload.roleOrContext as string) ?? null,
            quote: payload.quote as string,
            photoUrl: (payload.photoUrl as string) ?? null,
            order: (payload.order as number) ?? 0,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteTestimonial.update({
          where: { id: entityId },
          data: {
            name: payload.name ?? undefined,
            roleOrContext: payload.roleOrContext ?? undefined,
            quote: payload.quote ?? undefined,
            photoUrl: payload.photoUrl === "" ? null : (payload.photoUrl ?? undefined),
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_partner":
      if (action === "create") {
        await prisma.sitePartner.create({
          data: {
            name: payload.name as string,
            logoUrl: (payload.logoUrl as string) ?? null,
            websiteUrl: (payload.websiteUrl as string) ?? null,
            order: (payload.order as number) ?? 0,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.sitePartner.update({
          where: { id: entityId },
          data: {
            name: payload.name ?? undefined,
            logoUrl: payload.logoUrl === "" ? null : (payload.logoUrl ?? undefined),
            websiteUrl: payload.websiteUrl === "" ? null : (payload.websiteUrl ?? undefined),
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_news_category":
      if (action === "create") {
        await prisma.siteNewsCategory.create({
          data: {
            name: payload.name as string,
            slug: payload.slug as string,
            order: (payload.order as number) ?? 0,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteNewsCategory.update({
          where: { id: entityId },
          data: {
            name: payload.name ?? undefined,
            slug: payload.slug ?? undefined,
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_news_post":
      if (action === "create") {
        await prisma.siteNewsPost.create({
          data: {
            title: payload.title as string,
            slug: payload.slug as string,
            excerpt: (payload.excerpt as string) ?? null,
            content: (payload.content as string) ?? null,
            coverImageUrl: (payload.coverImageUrl as string) ?? null,
            imageUrls: (payload.imageUrls as string[]) ?? [],
            categoryId: (payload.categoryId as string) || null,
            publishedAt: payload.publishedAt ? new Date(payload.publishedAt as string) : null,
            isPublished: !!payload.isPublished,
          },
        });
      } else if (entityId) {
        await prisma.siteNewsPost.update({
          where: { id: entityId },
          data: {
            title: payload.title ?? undefined,
            slug: payload.slug ?? undefined,
            excerpt: payload.excerpt ?? undefined,
            content: payload.content ?? undefined,
            coverImageUrl: payload.coverImageUrl === "" ? null : (payload.coverImageUrl ?? undefined),
            imageUrls: payload.imageUrls ?? undefined,
            categoryId: payload.categoryId === "" ? null : (payload.categoryId ?? undefined),
            publishedAt: payload.publishedAt ? new Date(payload.publishedAt as string) : undefined,
            isPublished: payload.isPublished ?? undefined,
          } as never,
        });
      }
      return;
    case "site_faq_item":
      if (action === "create") {
        await prisma.siteFaqItem.create({
          data: {
            question: payload.question as string,
            answer: payload.answer as string,
            order: (payload.order as number) ?? 0,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteFaqItem.update({
          where: { id: entityId },
          data: {
            question: payload.question ?? undefined,
            answer: payload.answer ?? undefined,
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_transparency_category":
      if (action === "create") {
        await prisma.siteTransparencyCategory.create({
          data: {
            name: payload.name as string,
            slug: payload.slug as string,
            order: (payload.order as number) ?? 0,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteTransparencyCategory.update({
          where: { id: entityId },
          data: {
            name: payload.name ?? undefined,
            slug: payload.slug ?? undefined,
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_transparency_document":
      if (action === "create") {
        await prisma.siteTransparencyDocument.create({
          data: {
            categoryId: payload.categoryId as string,
            title: payload.title as string,
            description: (payload.description as string) ?? null,
            date: payload.date ? new Date(payload.date as string) : null,
            fileUrl: (payload.fileUrl as string) ?? null,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteTransparencyDocument.update({
          where: { id: entityId },
          data: {
            categoryId: payload.categoryId ?? undefined,
            title: payload.title ?? undefined,
            description: payload.description ?? undefined,
            date: payload.date ? new Date(payload.date as string) : undefined,
            fileUrl: payload.fileUrl === "" ? null : (payload.fileUrl ?? undefined),
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_formation":
      if (action === "create") {
        await prisma.siteFormation.create({
          data: {
            title: payload.title as string,
            slug: payload.slug as string,
            summary: (payload.summary as string) ?? null,
            audience: (payload.audience as string) ?? null,
            outcomes: (payload.outcomes as string[]) ?? [],
            finalProject: (payload.finalProject as string) ?? null,
            prerequisites: (payload.prerequisites as string) ?? null,
            order: (payload.order as number) ?? 0,
            isActive: payload.isActive !== false,
          },
        });
      } else if (entityId) {
        await prisma.siteFormation.update({
          where: { id: entityId },
          data: {
            title: payload.title ?? undefined,
            slug: payload.slug ?? undefined,
            summary: payload.summary ?? undefined,
            audience: payload.audience ?? undefined,
            outcomes: payload.outcomes ?? undefined,
            finalProject: payload.finalProject ?? undefined,
            prerequisites: payload.prerequisites ?? undefined,
            order: payload.order ?? undefined,
            isActive: payload.isActive ?? undefined,
          } as never,
        });
      }
      return;
    case "site_formation_courses":
      if (action === "update" && entityId && Array.isArray(payload.courseIds)) {
        const formationId = entityId;
        await prisma.siteFormationCourse.deleteMany({ where: { formationId } });
        const courseIds = payload.courseIds as string[];
        if (courseIds.length > 0) {
          await prisma.siteFormationCourse.createMany({
            data: courseIds.map((courseId, i) => ({
              formationId,
              courseId,
              order: i,
            })),
          });
        }
      }
      return;
    case "site_menu":
      if (action === "update" && Array.isArray(payload.ids)) {
        const ids = payload.ids as string[];
        await prisma.$transaction(
          ids.map((id, index) => prisma.siteMenuItem.update({ where: { id }, data: { order: index } }))
        );
      }
      return;
    case "site_project_reorder":
      if (Array.isArray(payload.ids)) {
        const ids = payload.ids as string[];
        await prisma.$transaction(
          ids.map((id, i) => prisma.siteProject.update({ where: { id }, data: { order: i } }))
        );
      }
      return;
    default:
      throw new Error(`Unknown entityType: ${entityType}`);
  }
}
