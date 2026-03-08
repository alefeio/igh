import "server-only";
import { prisma } from "@/lib/prisma";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import type { MenuItemPublic, SiteSettingsPublic } from "@/lib/site-types";

export type { MenuItemPublic, SiteSettingsPublic };

export async function getMenuItems(): Promise<MenuItemPublic[]> {
  try {
  const items = await prisma.siteMenuItem.findMany({
    where: { isVisible: true, parentId: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      children: {
        where: { isVisible: true },
        orderBy: [{ order: "asc" }],
      },
    },
  });
  return items.map((i) => ({
    id: i.id,
    label: i.label,
    href: i.href,
    order: i.order,
    isExternal: i.isExternal,
    children: i.children.map((c) => ({
      id: c.id,
      label: c.label,
      href: c.href,
      order: c.order,
      isExternal: c.isExternal,
      children: [],
    })),
  }));
  } catch {
    return [];
  }
}

// --- Settings (para Footer e SEO) ---
function parseAddresses(value: unknown): { line: string; city: string; state: string; zip: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === "object" && "line" in x && "city" in x && "state" in x && "zip" in x
    )
    .map((x) => ({
      line: String(x.line ?? ""),
      city: String(x.city ?? ""),
      state: String(x.state ?? ""),
      zip: String(x.zip ?? ""),
    }));
}

export async function getSiteSettings(): Promise<SiteSettingsPublic | null> {
  try {
    const s = await prisma.siteSettings.findFirst();
    if (!s) return null;
    return {
    siteName: s.siteName,
    logoUrl: s.logoUrl,
    faviconUrl: s.faviconUrl,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    contactWhatsapp: s.contactWhatsapp,
    addresses: parseAddresses(s.addresses),
    businessHours: s.businessHours,
    socialInstagram: s.socialInstagram,
    socialFacebook: s.socialFacebook,
    socialYoutube: s.socialYoutube,
    socialLinkedin: s.socialLinkedin,
    seoTitleDefault: s.seoTitleDefault,
    seoDescriptionDefault: s.seoDescriptionDefault,
  };
  } catch {
    return null;
  }
}

// --- Sobre (página institucional) ---
export type AboutForSite = { title: string | null; subtitle: string | null; content: string | null; imageUrl: string | null };

export async function getAboutForSite(): Promise<AboutForSite | null> {
  try {
    const row = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!row) return null;
    return { title: row.title, subtitle: row.subtitle, content: row.content, imageUrl: row.imageUrl };
  } catch {
    return null;
  }
}

// --- Página Formações (cabeçalho editável) ---
export type FormacoesPageForSite = { title: string | null; subtitle: string | null; headerImageUrl: string | null };

export async function getFormacoesPageForSite(): Promise<FormacoesPageForSite | null> {
  try {
    const row = await prisma.siteFormacoesPage.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!row) return null;
    return { title: row.title, subtitle: row.subtitle, headerImageUrl: row.headerImageUrl };
  } catch {
    return null;
  }
}

// --- Página Inscreva-se (cabeçalho editável) ---
export type InscrevaPageForSite = { title: string | null; subtitle: string | null; headerImageUrl: string | null };

export async function getInscrevaPageForSite(): Promise<InscrevaPageForSite | null> {
  try {
    const row = await prisma.siteInscrevaPage.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!row) return null;
    return { title: row.title, subtitle: row.subtitle, headerImageUrl: row.headerImageUrl };
  } catch {
    return null;
  }
}

// --- Página Contato (cabeçalho editável) ---
export type ContatoPageForSite = { title: string | null; subtitle: string | null; headerImageUrl: string | null };

export async function getContatoPageForSite(): Promise<ContatoPageForSite | null> {
  try {
    const row = await prisma.siteContatoPage.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!row) return null;
    return { title: row.title, subtitle: row.subtitle, headerImageUrl: row.headerImageUrl };
  } catch {
    return null;
  }
}

// --- Banners ---
export type BannerPublic = { id: string; title: string | null; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string | null; order: number };

export async function getBanners(): Promise<BannerPublic[]> {
  try {
    const list = await prisma.siteBanner.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "desc" }],
    });
    return list.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      ctaLabel: b.ctaLabel,
      ctaHref: b.ctaHref,
      imageUrl: b.imageUrl,
      order: b.order,
    }));
  } catch {
    return [];
  }
}

// --- Parceiros ---
export type PartnerPublic = { id: string; name: string; logoUrl: string | null; websiteUrl: string | null; order: number };

export async function getPartners(): Promise<PartnerPublic[]> {
  try {
    const list = await prisma.sitePartner.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    });
    return list.map((p) => ({
      id: p.id,
      name: p.name,
      logoUrl: p.logoUrl,
      websiteUrl: p.websiteUrl,
      order: p.order,
    }));
  } catch {
    return [];
  }
}

// --- FAQ ---
export type FaqItemPublic = { id: string; question: string; answer: string; order: number };

export async function getFaqItems(): Promise<FaqItemPublic[]> {
  try {
    const list = await prisma.siteFaqItem.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    });
    return list.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      order: f.order,
    }));
  } catch {
    return [];
  }
}

// --- Depoimentos ---
export type TestimonialPublic = { id: string; name: string; roleOrContext: string | null; quote: string; photoUrl: string | null; order: number };

export async function getTestimonials(): Promise<TestimonialPublic[]> {
  try {
    const list = await prisma.siteTestimonial.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    });
    return list.map((t) => ({
      id: t.id,
      name: t.name,
      roleOrContext: t.roleOrContext,
      quote: t.quote,
      photoUrl: t.photoUrl,
      order: t.order,
    }));
  } catch {
    return [];
  }
}

// --- Formações ---
export type FormationWithCourses = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  audience: string | null;
  outcomes: string[];
  finalProject: string | null;
  prerequisites: string | null;
  order: number;
  isActive: boolean;
  courses: {
    order: number;
    course: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      content: string | null;
      imageUrl: string | null;
      workloadHours: number | null;
      status: string;
    };
  }[];
};

export type HowFormationWorksItem = {
  titulo: string;
  descricao: string;
};

const COMO_FUNCIONA_FALLBACK: HowFormationWorksItem[] = [
  { titulo: "Núcleo Comum", descricao: "Conteúdo base em tecnologia e competências transversais para todas as trilhas." },
  { titulo: "Trilha Técnica", descricao: "Módulos específicos da área escolhida, com foco em prática e ferramentas atuais." },
  { titulo: "Projeto Integrador", descricao: "Projeto real desenvolvido ao longo da formação, que compõe seu portfólio." },
  { titulo: "Carreira e Demo Day", descricao: "Preparação para o mercado, networking e apresentação dos projetos." },
];

export async function getFormationsWithCourses(): Promise<FormationWithCourses[]> {
  try {
    const list = await prisma.siteFormation.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        courses: {
          orderBy: { order: "asc" },
          include: {
            course: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                content: true,
                imageUrl: true,
                workloadHours: true,
                status: true,
              },
            },
          },
        },
      },
    });
    return list.map((f) => ({
      id: f.id,
      title: f.title,
      slug: f.slug,
      summary: f.summary,
      audience: f.audience,
      outcomes: f.outcomes,
      finalProject: f.finalProject,
      prerequisites: f.prerequisites,
      order: f.order,
      isActive: f.isActive,
      courses: f.courses.map((fc) => ({
        order: fc.order,
        course: {
          ...fc.course,
          status: fc.course.status,
        },
      })),
    }));
  } catch {
    return [];
  }
}

export async function getFormationsForHome(limit = 4): Promise<FormationWithCourses[]> {
  try {
    const all = await getFormationsWithCourses();
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

export function getComoFuncionaFormacao(): HowFormationWorksItem[] {
  return COMO_FUNCIONA_FALLBACK;
}

// --- Formações como filtro (lista para botões) ---
export type FormationFilterItem = { id: string; title: string; slug: string };

export async function getFormationsForFilter(): Promise<FormationFilterItem[]> {
  try {
    const list = await prisma.siteFormation.findMany({
      where: {
        isActive: true,
        courses: { some: {} },
      },
      orderBy: [{ order: "asc" }],
      select: { id: true, title: true, slug: true },
    });
    return list;
  } catch {
    return [];
  }
}

// --- Cursos para o site (com filtro por formação) ---
export type LessonForSiteDetail = {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
};

export type ModuleForSiteDetail = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: LessonForSiteDetail[];
};

export type CourseForSite = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  workloadHours: number | null;
  formationId: string | null;
  formationTitle: string | null;
  formationSlug: string | null;
  /** Preenchido apenas em getCourseBySlug (detalhe). */
  modules?: ModuleForSiteDetail[];
};

export async function getCoursesForSite(formationSlug?: string): Promise<CourseForSite[]> {
  try {
    if (formationSlug) {
      const formation = await prisma.siteFormation.findFirst({
        where: { slug: formationSlug, isActive: true },
        include: {
          courses: {
            orderBy: { order: "asc" },
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  description: true,
                  content: true,
                  imageUrl: true,
                  workloadHours: true,
                  status: true,
                },
              },
            },
          },
        },
      });
      if (!formation) return [];
      return formation.courses
        .filter((fc) => fc.course != null && fc.course.status === "ACTIVE")
        .map((fc) => ({
          id: fc.course!.id,
          name: fc.course!.name,
          slug: fc.course!.slug,
          description: fc.course!.description,
          content: fc.course!.content,
          imageUrl: fc.course!.imageUrl,
          workloadHours: fc.course!.workloadHours,
          formationId: formation.id,
          formationTitle: formation.title,
          formationSlug: formation.slug,
        }));
    }

    const courses = await prisma.course.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        content: true,
        imageUrl: true,
        workloadHours: true,
        siteFormations: {
          take: 1,
          orderBy: { order: "asc" },
          select: { formation: { select: { id: true, title: true, slug: true } } },
        },
      },
    });

    return courses.map((c) => {
      const first = c.siteFormations[0]?.formation;
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        content: c.content,
        imageUrl: c.imageUrl,
        workloadHours: c.workloadHours,
        formationId: first?.id ?? null,
        formationTitle: first?.title ?? null,
        formationSlug: first?.slug ?? null,
      };
    });
  } catch {
    return [];
  }
}

// --- Projetos (site público) ---
export type ProjectForSite = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  order: number;
};

export async function getProjectsForSite(): Promise<ProjectForSite[]> {
  try {
    const list = await prisma.siteProject.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        coverImageUrl: true,
        galleryImages: true,
        order: true,
      },
    });
    return list.map((p) => ({ ...p, galleryImages: p.galleryImages ?? [] }));
  } catch {
    return [];
  }
}

export async function getProjectBySlug(slug: string): Promise<ProjectForSite | null> {
  try {
    const p = await prisma.siteProject.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        coverImageUrl: true,
        galleryImages: true,
        order: true,
      },
    });
    if (!p) return null;
    return { ...p, galleryImages: p.galleryImages ?? [] };
  } catch {
    return null;
  }
}

// --- Notícias (site público) ---
export type NewsCategoryForSite = { id: string; name: string; slug: string };

export type NewsPostForSite = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  categoryId: string | null;
  categoryName: string | null;
  publishedAt: Date | null;
};

export async function getNewsCategoriesForSite(): Promise<NewsCategoryForSite[]> {
  try {
    const list = await prisma.siteNewsCategory.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
      select: { id: true, name: true, slug: true },
    });
    return list;
  } catch {
    return [];
  }
}

export async function getNewsPostsForSite(categorySlug?: string): Promise<NewsPostForSite[]> {
  try {
    const where: { isPublished: true; category?: { slug: string } } = { isPublished: true };
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    const list = await prisma.siteNewsPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        imageUrls: true,
        categoryId: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });
    return list.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      coverImageUrl: p.coverImageUrl,
      imageUrls: p.imageUrls ?? [],
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      publishedAt: p.publishedAt,
    }));
  } catch {
    return [];
  }
}

export async function getNewsPostBySlug(slug: string): Promise<NewsPostForSite | null> {
  try {
    const p = await prisma.siteNewsPost.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        imageUrls: true,
        categoryId: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      coverImageUrl: p.coverImageUrl,
      imageUrls: p.imageUrls ?? [],
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      publishedAt: p.publishedAt,
    };
  } catch {
    return null;
  }
}

// --- Transparência (site público) ---
export type TransparencyCategoryForSite = {
  id: string;
  name: string;
  slug: string;
  order: number;
  documents: {
    id: string;
    title: string;
    description: string | null;
    date: Date | null;
    fileUrl: string | null;
  }[];
};

export async function getTransparencyForSite(): Promise<TransparencyCategoryForSite[]> {
  try {
    const list = await prisma.siteTransparencyCategory.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
      include: {
        documents: {
          where: { isActive: true },
          orderBy: [{ date: "desc" }],
          select: {
            id: true,
            title: true,
            description: true,
            date: true,
            fileUrl: true,
          },
        },
      },
    });
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      order: c.order,
      documents: c.documents.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        date: d.date,
        fileUrl: d.fileUrl,
      })),
    }));
  } catch {
    return [];
  }
}

// --- Curso por slug (detalhe para modal/página) ---
export async function getCourseBySlug(slug: string): Promise<CourseForSite | null> {
  try {
    const course = await prisma.course.findFirst({
      where: { slug, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        content: true,
        imageUrl: true,
        workloadHours: true,
        siteFormations: {
          take: 1,
          orderBy: { order: "asc" },
          select: { formation: { select: { id: true, title: true, slug: true } } },
        },
      },
    });
    if (!course) return null;
    const first = course.siteFormations[0]?.formation;
    const modulesWithLessons = await getModulesWithLessonsByCourseId(course.id);
    const modules: ModuleForSiteDetail[] = modulesWithLessons.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        order: l.order,
        durationMinutes: l.durationMinutes,
      })),
    }));
    return {
      id: course.id,
      name: course.name,
      slug: course.slug,
      description: course.description,
      content: course.content,
      imageUrl: course.imageUrl,
      workloadHours: course.workloadHours,
      formationId: first?.id ?? null,
      formationTitle: first?.title ?? null,
      formationSlug: first?.slug ?? null,
      modules,
    };
  } catch {
    return null;
  }
}
