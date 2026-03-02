import {
  Container,
  Section,
  Button,
  Card,
  Stats,
  Testimonials,
  CTASection,
  FAQ,
  BlogCard,
  FormacoesSection,
} from "@/components/site";
import { statsImpact, posts } from "@/content";
import {
  getFormationsForFilter,
  getCoursesForSite,
  getBanners,
  getPartners,
  getFaqItems,
  getTestimonials,
} from "@/lib/site-data";

export const metadata = {
  title: "Instituto Gustavo Hessel | Formação em tecnologia e inclusão digital",
  description:
    "Formações gratuitas em programação, dados, UX/UI e mais. Inclusão digital e recondicionamento de computadores.",
  openGraph: {
    title: "Instituto Gustavo Hessel | Formação em tecnologia e inclusão digital",
    description:
      "Formações gratuitas em programação, dados, UX/UI e mais. Inclusão digital e recondicionamento de computadores.",
  },
};

type Props = { searchParams: Promise<{ formacao?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const { formacao: formacaoSlug } = await searchParams;

  const [formations, coursesFull, banners, partners, faqItemsFromDb, testimonialsFromDb, recentPosts] =
    await Promise.all([
      getFormationsForFilter(),
      getCoursesForSite(formacaoSlug),
      getBanners(),
      getPartners(),
      getFaqItems(),
      getTestimonials(),
      Promise.resolve(posts.slice(0, 3)),
    ]);

  const courses = coursesFull.slice(0, 6);

  const faqItems = faqItemsFromDb.map((i) => ({ pergunta: i.question, resposta: i.answer }));
  const depoimentos = testimonialsFromDb.map((t) => ({
    nome: t.name,
    role: t.roleOrContext ?? "",
    texto: t.quote,
    avatar: t.photoUrl ?? undefined,
  }));

  const heroBanner = banners.length > 0 ? banners[0] : null;

  return (
    <>
      {/* Hero / Banner do banco */}
      {heroBanner ? (
        <section className="relative bg-[var(--igh-surface)] overflow-hidden">
          {heroBanner.imageUrl && (
            <div className="absolute inset-0 z-0">
              <img
                src={heroBanner.imageUrl}
                alt=""
                className="h-full w-full object-cover opacity-30"
              />
            </div>
          )}
          <Container className="relative z-10 py-16 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              {heroBanner.title && (
                <h1 className="text-3xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-4xl lg:text-5xl">
                  {heroBanner.title}
                </h1>
              )}
              {heroBanner.subtitle && (
                <p className="mt-4 text-lg text-[var(--igh-muted)]">
                  {heroBanner.subtitle}
                </p>
              )}
              {heroBanner.ctaLabel && heroBanner.ctaHref ? (
                <div className="mt-8">
                  <Button as="link" href={heroBanner.ctaHref} variant="primary" size="lg">
                    {heroBanner.ctaLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : (
        <section className="bg-[var(--igh-surface)] py-16 sm:py-24">
          <Container>
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-4xl lg:text-5xl">
                Formação em tecnologia que transforma vidas
              </h1>
              <p className="mt-4 text-lg text-[var(--igh-muted)]">
                Cursos gratuitos em programação, dados, UX/UI e marketing digital. Pré-requisito: Informática Básica.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button as="link" href="/formacoes" variant="primary" size="lg">
                  Ver formações
                </Button>
                <Button as="link" href="/contato#inscreva" variant="secondary" size="lg">
                  Inscrever-se
                </Button>
                <Button as="link" href="/projetos/doacoes-recebidas" variant="accent" size="lg">
                  Doe equipamentos
                </Button>
              </div>
            </div>
          </Container>
        </section>
      )}

      {/* Prova de impacto */}
      <Stats items={statsImpact} />

      {/* Formações e Cursos */}
      <Section
        title="Formações e Cursos"
        subtitle="Trilhas técnicas com projeto integrador e foco em carreira."
      >
        <FormacoesSection
          formations={formations}
          courses={courses}
          formacaoSlug={formacaoSlug}
          basePath="/"
        />
        <div className="mt-8 text-center">
          <Button as="link" href="/formacoes" variant="primary" size="lg">
            Ver todas as formações
          </Button>
        </div>
      </Section>

      {/* Projetos e sustentabilidade */}
      <Section
        title="Projetos e sustentabilidade"
        subtitle="CRC e Computadores para Inclusão: recondicionamento e doação de equipamentos."
        background="muted"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Card as="article">
            <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">CRC</h3>
            <p className="mt-2 text-sm text-[var(--igh-muted)]">
              Centros de Recondicionamento de Computadores onde equipamentos são triados, recondicionados e destinados a projetos de inclusão digital.
            </p>
            <Button as="link" href="/projetos/crc" variant="primary" size="sm" className="mt-4">
              Conhecer o CRC
            </Button>
          </Card>
          <Card as="article">
            <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">Computadores para Inclusão</h3>
            <p className="mt-2 text-sm text-[var(--igh-muted)]">
              Programa que recebe doações de equipamentos, recondiciona e doa a escolas, telecentros e iniciativas de inclusão.
            </p>
            <Button as="link" href="/projetos/computadores-para-inclusao" variant="primary" size="sm" className="mt-4">
              Saiba mais
            </Button>
          </Card>
        </div>
        <div className="mt-8 text-center">
          <Button as="link" href="/projetos" variant="secondary" size="lg">
            Ver todos os projetos
          </Button>
        </div>
      </Section>

      {/* Depoimentos */}
      {depoimentos.length > 0 && <Testimonials items={depoimentos} />}

      {/* Parceiros */}
      <Section title="Parceiros e apoio" background="muted">
        <div className="flex flex-wrap items-center justify-center gap-8">
          {partners.length === 0 ? (
            <p className="text-center text-[var(--igh-muted)]">Nenhum parceiro cadastrado.</p>
          ) : (
            partners.map((p) => (
              <a
                key={p.id}
                href={p.websiteUrl || undefined}
                target={p.websiteUrl ? "_blank" : undefined}
                rel={p.websiteUrl ? "noreferrer noopener" : undefined}
                className="group flex h-16 w-36 items-center justify-center rounded-lg border border-[var(--igh-border)] bg-white px-3 text-[var(--igh-muted)] text-sm transition hover:border-zinc-300 hover:shadow-sm"
                title={p.name}
                aria-label={p.websiteUrl ? `Abrir site do parceiro: ${p.name}` : p.name}
              >
                {p.logoUrl ? (
                  <img
                    src={p.logoUrl}
                    alt={p.name}
                    className="max-h-10 w-full object-contain opacity-90 transition group-hover:opacity-100"
                    loading="lazy"
                  />
                ) : (
                  <span className="line-clamp-2 text-center">{p.name}</span>
                )}
              </a>
            ))
          )}
        </div>
      </Section>

      {/* Blog / Notícias */}
      <Section title="Notícias" subtitle="Acompanhe as novidades do IGH.">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recentPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button as="link" href="/noticias" variant="outline" size="lg">
            Ver todas as notícias
          </Button>
        </div>
      </Section>

      {/* FAQ */}
      {faqItems.length > 0 && <FAQ items={faqItems} />}

      {/* CTA final */}
      <CTASection
        title="Pronto para começar?"
        subtitle="Inscreva-se em uma formação, fale com a gente ou doe equipamentos."
        primaryCTA={{ label: "Quero me inscrever", href: "/contato" }}
        secondaryCTAs={[
          { label: "Fale com o IGH", href: "/contato" },
          { label: "Doe equipamentos", href: "/projetos/doacoes-recebidas" },
        ]}
      />
    </>
  );
}
