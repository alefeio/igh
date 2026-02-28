import "server-only";
import { prisma } from "@/lib/prisma";
import type { MenuItemPublic, SiteSettingsPublic } from "@/lib/site-types";

export type { MenuItemPublic, SiteSettingsPublic };

export async function getMenuItems(): Promise<MenuItemPublic[]> {
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
}

// --- Settings (para Footer e SEO) ---
export async function getSiteSettings(): Promise<SiteSettingsPublic | null> {
  const s = await prisma.siteSettings.findFirst();
  if (!s) return null;
  return {
    siteName: s.siteName,
    logoUrl: s.logoUrl,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    socialInstagram: s.socialInstagram,
    socialFacebook: s.socialFacebook,
    socialYoutube: s.socialYoutube,
    socialLinkedin: s.socialLinkedin,
    addressLine: s.addressLine,
    addressCity: s.addressCity,
    addressState: s.addressState,
    addressZip: s.addressZip,
  };
}

// --- Banners ---
export type BannerPublic = { id: string; title: string | null; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string | null; order: number };

export async function getBanners(): Promise<BannerPublic[]> {
  const list = await prisma.siteBanner.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }],
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
}

// --- Parceiros ---
export type PartnerPublic = { id: string; name: string; logoUrl: string | null; websiteUrl: string | null; order: number };

export async function getPartners(): Promise<PartnerPublic[]> {
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
}

// --- FAQ ---
export type FaqItemPublic = { id: string; question: string; answer: string; order: number };

export async function getFaqItems(): Promise<FaqItemPublic[]> {
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
}

// --- Depoimentos ---
export type TestimonialPublic = { id: string; name: string; roleOrContext: string | null; quote: string; photoUrl: string | null; order: number };

export async function getTestimonials(): Promise<TestimonialPublic[]> {
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
}

export async function getFormationsForHome(limit = 4): Promise<FormationWithCourses[]> {
  const all = await getFormationsWithCourses();
  return all.slice(0, limit);
}

export function getComoFuncionaFormacao(): HowFormationWorksItem[] {
  return COMO_FUNCIONA_FALLBACK;
}
