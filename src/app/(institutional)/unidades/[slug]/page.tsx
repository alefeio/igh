import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UnitLandingPageContent } from "@/components/site/UnitLandingPageContent";
import { BRAND, pageTitleLegal } from "@/lib/brand";
import { getActiveSiteUnitSlugs, getSiteUnitPublicBySlug } from "@/lib/site-data";

type Props = { params: Promise<{ slug: string }> };

const FALLBACK_OG = "/images/lp/codo/banner-principal-laboratorio.jpg";

export async function generateStaticParams() {
  const slugs = await getActiveSiteUnitSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const unit = await getSiteUnitPublicBySlug(slug);
  if (!unit) {
    return { title: pageTitleLegal("Unidade"), robots: { index: false, follow: false } };
  }

  const place = `${unit.city}/${unit.state}`;
  const title = `${BRAND.legalName} | Cursos gratuitos de tecnologia em ${place}`;
  const descriptionBase =
    unit.heroText?.replace(/\s+/g, " ").trim() ||
    `Unidade do ${BRAND.shortName} em ${place}: cursos gratuitos de informática e tecnologia com foco em inclusão digital.`;
  const description = descriptionBase.length > 160 ? `${descriptionBase.slice(0, 157).trimEnd()}...` : descriptionBase;
  const path = `/unidades/${unit.slug}`;
  const ogImage = unit.heroImageUrl?.trim() || FALLBACK_OG;
  const keywords = Array.from(
    new Set(
      [
        BRAND.legalName,
        BRAND.shortName,
        "cursos gratuitos",
        "tecnologia",
        "informática",
        unit.city,
        unit.state,
        unit.locationName ?? "",
        ...(unit.courses ?? []).map((c) => c.name),
      ]
        .map((s) => (s ?? "").toString().trim())
        .filter(Boolean),
    ),
  );

  return {
    title,
    description,
    keywords,
    robots: { index: true, follow: true },
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      url: path,
      siteName: BRAND.legalName,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${BRAND.legalName} em ${unit.city}/${unit.state}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function UnidadeLandingPage({ params }: Props) {
  const { slug } = await params;
  const unit = await getSiteUnitPublicBySlug(slug);
  if (!unit) notFound();

  return <UnitLandingPageContent unit={unit} />;
}
