import { z } from "zod";

const slugSchema = z.string().min(1, "Slug é obrigatório").regex(/^[a-z0-9-]+$/, "Slug: apenas letras minúsculas, números e hífens");

// SiteAboutPage (singleton)
export const siteAboutPageSchema = z.object({
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().or(z.literal("")).nullable(),
});

// SiteFormacoesPage (singleton - cabeçalho da página Formações)
export const siteFormacoesPageSchema = z.object({
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  headerImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
});

// SiteInscrevaPage (singleton - cabeçalho da página Inscreva-se)
export const siteInscrevaPageSchema = z.object({
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  headerImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
});

// SiteContatoPage (singleton - cabeçalho da página Contato)
export const siteContatoPageSchema = z.object({
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  headerImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
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
  addresses: z
    .array(
      z.object({
        line: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
      })
    )
    .optional(),
  businessHours: z.string().optional(),
  socialInstagram: z.string().optional(),
  socialFacebook: z.string().optional(),
  socialYoutube: z.string().optional(),
  socialLinkedin: z.string().optional(),
  seoTitleDefault: z.string().optional(),
  seoDescriptionDefault: z.string().optional(),
  publicAppUrl: z.union([z.literal(""), z.string().url("URL inválida (use https://...)")]).optional(),
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

// TabletBanner
export const tabletBannerSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
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

// Mensagem do formulário de contato (público)
export const contactMessageSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  phone: z.string().min(1, "Telefone é obrigatório").max(20, "Telefone muito longo"),
  message: z.string().min(1, "Mensagem é obrigatória").max(5000, "Mensagem muito longa"),
});

// Depoimento enviado pelo público (pendente de aprovação)
export const publicTestimonialSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  roleOrContext: z.string().max(200).optional().or(z.literal("")),
  quote: z.string().min(1, "Depoimento é obrigatório").max(2000, "Depoimento muito longo"),
  photoUrl: z.string().url().optional().or(z.literal("")),
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
