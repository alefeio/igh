import { PageHeader, Section, MediaCarousel } from "@/components/site";
import { ESPACO_MAKER_PAGE_DEFAULT } from "@/content/espaco-maker";
import { getEspacoMakerPageForSite } from "@/lib/site-data";

export const metadata = {
  title: "Espaço Maker IGH | Instituto Gustavo Hessel",
  description:
    "Ambiente colaborativo de tecnologia, criatividade e inclusão digital no Instituto Gustavo Hessel. Aprenda fazendo com robótica, impressão 3D, manutenção e mais.",
  openGraph: {
    title: "Espaço Maker IGH | Instituto Gustavo Hessel",
    description:
      "Tecnologia, criatividade e inclusão por meio do aprender fazendo. Conheça o Espaço Maker do IGH.",
  },
};

export default async function EspacoMakerPage() {
  const page = await getEspacoMakerPageForSite();
  const title = page?.title?.trim() || ESPACO_MAKER_PAGE_DEFAULT.title;
  const subtitle = page?.subtitle?.trim() || ESPACO_MAKER_PAGE_DEFAULT.subtitle;
  const content = page?.content?.trim() || ESPACO_MAKER_PAGE_DEFAULT.content;
  const mediaUrls = page?.mediaUrls?.filter((u) => u?.trim()) ?? [];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        below={
          mediaUrls.length > 0 ? (
            <MediaCarousel urls={mediaUrls} fullBleed autoScroll className="w-full" />
          ) : undefined
        }
      />

      <Section>
        <div
          className="prose prose-lg mx-auto max-w-3xl text-[var(--igh-muted)] [&_h2]:mt-10 [&_h2]:text-[var(--igh-secondary)] [&_li]:marker:text-[var(--igh-primary)] [&_strong]:text-[var(--igh-secondary)]"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </Section>
    </>
  );
}
