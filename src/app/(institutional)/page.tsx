import {
  Container,
  Section,
  Button,
  Card,
  Testimonials,
  CTASection,
  FAQ,
  BlogCard,
  FormacoesSection,
  HomeAudiencePathsStrip,
  HomePublicRatingStrip,
  HomeObjectiveTrails,
  HomeHowItWorksSection,
  HeroBannerCarousel,
  StudentRankingShowcase,
  PlatformExperienceHomeSection,
  MothersDayMessagesHomeSection,
  CommunityCtaHomeSection,
} from "@/components/site";
import { statsImpact } from "@/content";
import { enrollmentFaqItems } from "@/content";
import {
  getFormationsForFilter,
  getCoursesForSite,
  getBanners,
  getPartners,
  getFaqItems,
  getTestimonials,
  getNewsPostsForSite,
  getPublicStudentRanking,
  getPublicPlatformExperienceBlock,
  getPublicMotherCampaignMessages,
} from "@/lib/site-data";
import { getSessionUserFromCookie } from "@/lib/auth";

export const metadata = {
  title: "Instituto Gustavo Hessel | Formação profissional em tecnologia",
  description:
    "Formação profissional gratuita em programação, dados, UX/UI e mais. Inscreva-se e comece sua trilha no IGH.",
  openGraph: {
    title: "Instituto Gustavo Hessel | Formação profissional em tecnologia",
    description:
      "Formação profissional gratuita em programação, dados, UX/UI e mais. Inscreva-se e comece sua trilha no IGH.",
  },
};

type Props = {
  searchParams: Promise<{ formacao?: string; q?: string; objetivo?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const { formacao: formacaoSlug, q: searchQuery, objetivo } = await searchParams;

  const [
    formations,
    coursesFull,
    banners,
    partners,
    faqItemsFromDb,
    testimonialsFromDb,
    newsPosts,
    studentRanking,
    platformExperienceBlock,
    mothersDaySection,
    sessionUser,
  ] = await Promise.all([
    getFormationsForFilter(),
    // Catálogo amplo: carrega todos para busca/objetivo client-side
    getCoursesForSite(),
    getBanners(),
    getPartners(),
    getFaqItems(),
    getTestimonials(),
    getNewsPostsForSite(),
    getPublicStudentRanking(5),
    getPublicPlatformExperienceBlock(),
    getPublicMotherCampaignMessages(18),
    getSessionUserFromCookie(),
  ]);

  const recentPosts = newsPosts.slice(0, 2).map((p) => {
    let date = "";
    if (p.publishedAt) {
      const d = p.publishedAt;
      date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
    return {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? "",
      category: p.categoryName ?? "Notícia",
      date,
      image: p.coverImageUrl ?? undefined,
    };
  });

  const courses = coursesFull;
  const enrollmentFaq = enrollmentFaqItems;
  const faqItems = [
    ...enrollmentFaq,
    ...faqItemsFromDb.map((i) => ({ pergunta: i.question, resposta: i.answer })),
  ];
  const depoimentos = testimonialsFromDb.map((t) => ({
    nome: t.name,
    role: t.roleOrContext ?? "",
    texto: t.quote,
    avatar: t.photoUrl ?? undefined,
  }));

  return (
    <>
      {banners.length > 0 ? (
        <HeroBannerCarousel banners={banners} />
      ) : (
        <section className="flex min-h-[70vh] flex-col justify-center bg-[var(--igh-surface)] py-16 sm:min-h-[80vh] sm:py-24">
          <Container>
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-4xl lg:text-5xl">
                Formação profissional em tecnologia, no seu ritmo
              </h1>
              <p className="mt-4 text-lg text-[var(--igh-muted)]">
                Cursos e trilhas gratuitas para começar ou avançar na carreira — com aulas, exercícios e certificado.
                Pré-requisito: Informática Básica.
              </p>
              <form
                action="/formacoes"
                method="get"
                role="search"
                className="mx-auto mt-8 max-w-xl"
                aria-label="Buscar no catálogo"
              >
                <label htmlFor="home-hero-busca" className="sr-only">
                  Buscar curso, tema ou formação
                </label>
                <div className="flex gap-2">
                  <input
                    id="home-hero-busca"
                    name="q"
                    type="search"
                    placeholder="Buscar curso, tema ou formação…"
                    className="min-h-[48px] flex-1 rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] px-4 text-sm text-[var(--igh-secondary)] placeholder:text-[var(--igh-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]/30"
                  />
                  <Button type="submit" variant="secondary" size="lg" className="shrink-0">
                    Buscar
                  </Button>
                </div>
              </form>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <Button as="link" href="/inscreva" variant="primary" size="lg">
                  Quero me inscrever
                </Button>
                <Button as="link" href="/formacoes" variant="outline" size="lg">
                  Ver catálogo
                </Button>
              </div>
            </div>
          </Container>
        </section>
      )}

      <HomeAudiencePathsStrip />
      <HomePublicRatingStrip block={platformExperienceBlock} stats={statsImpact} />
      <HomeObjectiveTrails basePath="/" />

      <div id="catalogo" className="scroll-mt-24">
        <Section
          title="Formações e Cursos"
          subtitle="Catálogo amplo: busque por tema, filtre por formação ou escolha um objetivo acima."
        >
          <FormacoesSection
            formations={formations}
            courses={courses}
            formacaoSlug={formacaoSlug}
            initialQuery={searchQuery ?? ""}
            initialObjetivo={objetivo}
            basePath="/"
          />
          <div className="mt-8 text-center">
            <Button as="link" href="/inscreva" variant="primary" size="lg">
              Quero me inscrever
            </Button>
          </div>
        </Section>
      </div>

      <HomeHowItWorksSection />

      <MothersDayMessagesHomeSection
        items={mothersDaySection.items}
        participationOpen={mothersDaySection.participationOpen}
      />

      <CTASection
        title="Pronto para começar sua formação?"
        subtitle="Inscreva-se em uma turma e acompanhe suas aulas na plataforma do IGH."
        primaryCTA={{ label: "Quero me inscrever", href: "/inscreva" }}
        secondaryCTAs={[{ label: "Ver todas as formações", href: "/formacoes" }]}
      />

      <Testimonials
        subtitle={
          <>
            Histórias de quem passou por aqui. Para médias e comentários sobre a experiência na plataforma, veja{" "}
            <a
              href="#avaliacoes-alunos"
              className="font-semibold text-[var(--igh-primary)] underline decoration-[var(--igh-primary)]/40 underline-offset-2 hover:decoration-[var(--igh-primary)]"
            >
              o que os alunos avaliam
            </a>
            .
          </>
        }
        items={depoimentos}
        courses={courses.map((c) => ({ id: c.id, name: c.name }))}
      />

      {faqItems.length > 0 && (
        <FAQ items={faqItems} title="Dúvidas sobre matrícula e o IGH" />
      )}

      {/* Secundário: comunidade, ranking compacto, avaliações, projetos, notícias */}
      <CommunityCtaHomeSection
        sessionUser={sessionUser ? { name: sessionUser.name, role: sessionUser.role } : null}
      />

      {studentRanking.length > 0 && <StudentRankingShowcase items={studentRanking} />}

      <PlatformExperienceHomeSection block={platformExperienceBlock} />

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
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button as="link" href="/projetos" variant="outline" size="lg">
            Ver todos os projetos
          </Button>
          <Button as="link" href="/projetos/doacoes-recebidas" variant="outline" size="lg">
            Doe equipamentos
          </Button>
        </div>
      </Section>

      {recentPosts.length > 0 && (
        <Section title="Notícias" subtitle="Novidades do IGH.">
          <div className="grid gap-6 sm:grid-cols-2">
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
      )}

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
                className="group flex h-16 w-36 items-center justify-center rounded-lg border border-[var(--igh-border)] bg-white px-3 text-[var(--igh-muted)] text-sm transition hover:border-[var(--igh-border)] hover:shadow-sm"
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
    </>
  );
}
