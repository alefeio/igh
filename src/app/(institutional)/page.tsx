import Link from "next/link";
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
} from "@/components/site";
import {
  statsImpact,
  parceiros,
  faqItems,
  depoimentos,
  formaçõesDestaque,
  posts,
} from "@/content";

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

export default function HomePage() {
  const recentPosts = posts.slice(0, 3);

  return (
    <>
      {/* Hero */}
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

      {/* Prova de impacto */}
      <Stats items={statsImpact} />

      {/* Formações em destaque */}
      <Section
        title="Formações em destaque"
        subtitle="Trilhas técnicas com projeto integrador e foco em carreira."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {formaçõesDestaque.map((f) => (
            <Card key={f.id} as="article">
              <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">{f.name}</h3>
              <p className="mt-2 text-sm text-[var(--igh-muted)]">{f.shortDesc}</p>
              <Button as="link" href="/formacoes" variant="outline" size="sm" className="mt-4 w-full">
                Saiba mais
              </Button>
            </Card>
          ))}
        </div>
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
      <Testimonials items={depoimentos} />

      {/* Parceiros */}
      <Section title="Parceiros e apoio" background="muted">
        <div className="flex flex-wrap items-center justify-center gap-8">
          {parceiros.map((p, i) => (
            <div
              key={i}
              className="flex h-16 w-32 items-center justify-center rounded-lg bg-white border border-[var(--igh-border)] text-[var(--igh-muted)] text-sm"
              title={p.name}
            >
              {p.name}
            </div>
          ))}
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
      <FAQ items={faqItems} />

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
