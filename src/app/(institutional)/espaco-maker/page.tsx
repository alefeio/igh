import { PageHeader, Section, Button, CTASection, MediaCarousel } from "@/components/site";
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
      <PageHeader title={title} subtitle={subtitle} />

      {mediaUrls.length > 0 && (
        <Section className="!pt-8 !pb-4 sm:!pt-10">
          <MediaCarousel urls={mediaUrls} className="mx-auto max-w-6xl" />
        </Section>
      )}

      <Section>
        <div
          className="prose prose-lg mx-auto max-w-3xl text-[var(--igh-muted)] [&_h2]:mt-10 [&_h2]:text-[var(--igh-secondary)] [&_li]:marker:text-[var(--igh-primary)] [&_strong]:text-[var(--igh-secondary)]"
          dangerouslySetInnerHTML={{ __html: content }}
        />
        {/* <div className="mx-auto mt-10 flex max-w-3xl flex-wrap gap-3">
          <Button as="link" href="/projetos/crc" variant="outline">
            Conhecer o CRC
          </Button>
          <Button as="link" href="/projetos/computadores-para-inclusao" variant="outline">
            Computadores para Inclusão
          </Button>
        </div> */}
      </Section>

      {/* <CTASection
        title="Venha aprender, criar e transformar"
        subtitle="Consulte as turmas disponíveis e faça parte dessa experiência."
        primaryCTA={{ label: "Ver cursos e turmas disponíveis", href: "/formacoes" }}
        secondaryCTAs={[
          { label: "Falar com o IGH", href: "/contato" },
          { label: "Conhecer os projetos do Instituto", href: "/projetos" },
        ]}
      /> */}
    </>
  );
}
