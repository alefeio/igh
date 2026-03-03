import { z } from "zod";

const slugSchema = z.string().min(1, "Slug é obrigatório").regex(/^[a-z0-9-]+$/, "Slug: apenas letras minúsculas, números e hífens");

// SiteAboutPage (singleton)
export const siteAboutPageSchema = z.object({
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
});

// SiteSettings (singleton)
export const siteSettingsSchema = z.object({
  siteName: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  contactWhatsapp: z.string().optional(),
  addressLine: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  businessHours: z.string().optional(),
  socialInstagram: z.string().optional(),
  socialFacebook: z.string().optional(),
  socialYoutube: z.string().optional(),
  socialLinkedin: z.string().optional(),
  seoTitleDefault: z.string().optional(),
  seoDescriptionDefault: z.string().optional(),
});

// SiteMenuItem
export const siteMenuItemSchema = z.object({
  label: z.string().min(1, "Label é obrigatório"),
  href: z.string().min(1, "Link é obrigatório"),
  order: z.number().int().min(0).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isExternal: z.boolean().optional(),
  isVisible: z.boolean().optional(),
});

// SiteBanner
export const siteBannerSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// SiteFormation
export const siteFormationSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  slug: slugSchema,
  summary: z.string().optional(),
  audience: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
  finalProject: z.string().optional(),
  prerequisites: z.string().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  courseIds: z.array(z.string().uuid()).optional(),
});

export const siteFormationCourseSchema = z.object({
  formationId: z.string().uuid(),
  courseId: z.string().uuid(),
  order: z.number().int().min(0).optional(),
});

export const siteFormationReorderSchema = z.object({
  formationId: z.string().uuid(),
  courseIds: z.array(z.string().uuid()),
});

// SiteProject
export const siteProjectSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  slug: slugSchema,
  summary: z.string().optional(),
  content: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  galleryImages: z.array(z.string().url()).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// SiteTestimonial
export const siteTestimonialSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  roleOrContext: z.string().optional(),
  quote: z.string().min(1, "Depoimento é obrigatório"),
  photoUrl: z.string().url().optional().or(z.literal("")),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// SitePartner
export const sitePartnerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// SiteNewsCategory
export const siteNewsCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: slugSchema,
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// SiteNewsPost
export const siteNewsPostSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  slug: slugSchema,
  excerpt: z.string().optional(),
  content: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  imageUrls: z.array(z.string().url()).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  publishedAt: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

// SiteFaqItem
export const siteFaqItemSchema = z.object({
  question: z.string().min(1, "Pergunta é obrigatória"),
  answer: z.string().min(1, "Resposta é obrigatória"),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// SiteTransparencyCategory
export const siteTransparencyCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: slugSchema,
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// SiteTransparencyDocument
export const siteTransparencyDocumentSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  date: z.string().optional().nullable(),
  fileUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

// Reorder payloads
export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()),
});
