import { PageHeader, Section, MediaCarousel } from "@/components/site";
import { BRAND, pageTitleLegal } from "@/lib/brand";
import { getEspacoMakerPageForSite } from "@/lib/site-data";

const makerTitle = pageTitleLegal(`Espaço Maker ${BRAND.shortName}`);

export const metadata = {
  title: makerTitle,
  description: `Ambiente colaborativo de tecnologia, criatividade e inclusão digital no ${BRAND.legalName}. Aprenda fazendo com robótica, impressão 3D, manutenção e mais.`,
  openGraph: {
    title: makerTitle,
    description: `Tecnologia, criatividade e inclusão por meio do aprender fazendo. Conheça o Espaço Maker do ${BRAND.shortName}.`,
  },
};

export default async function EspacoMakerPage() {
  const page = await getEspacoMakerPageForSite();
  const title = page?.title?.trim() || "";
  const subtitle = page?.subtitle?.trim() || "";
  const content = page?.content?.trim() || "";
  const mediaUrls = page?.mediaUrls?.filter((u) => u?.trim()) ?? [];

  if (!title && !subtitle && !content && mediaUrls.length === 0) {
    return null;
  }

  return (
    <>
      {(title || subtitle || mediaUrls.length > 0) && (
        <PageHeader
          title={title}
          subtitle={subtitle || undefined}
          below={
            mediaUrls.length > 0 ? (
              <MediaCarousel urls={mediaUrls} fullBleed autoScroll className="w-full" />
            ) : undefined
          }
        />
      )}

      {content ? (
        <Section>
          <div
            className="prose prose-lg mx-auto max-w-3xl text-[var(--igh-muted)] [&_h2]:mt-10 [&_h2]:text-[var(--igh-secondary)] [&_li]:marker:text-[var(--igh-primary)] [&_strong]:text-[var(--igh-secondary)]"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </Section>
      ) : null}
    </>
  );
}
