import { Container } from "./Container";

export type ObjectiveTrailId = "iniciar" | "atualizar" | "recolocar" | "continuar";

const TRAILS: {
  id: ObjectiveTrailId;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    id: "iniciar",
    title: "Quero começar",
    description: "Primeiros passos em tecnologia e informática.",
    href: "/formacoes?objetivo=iniciar",
  },
  {
    id: "atualizar",
    title: "Quero me atualizar",
    description: "Aprofundar habilidades e ferramentas atuais.",
    href: "/formacoes?objetivo=atualizar",
  },
  {
    id: "recolocar",
    title: "Quero me recolocar",
    description: "Formação com foco em carreira e mercado.",
    href: "/formacoes?objetivo=recolocar",
  },
  {
    id: "continuar",
    title: "Formação contínua",
    description: "Seguir estudando e especializar sua trilha.",
    href: "/formacoes?objetivo=continuar",
  },
];

/**
 * Trilhas por objetivo (learner-first): descoberta por intenção, não só por nome de curso.
 */
export function HomeObjectiveTrails({
  basePath = "/formacoes",
}: {
  /** Quando na home, pode apontar para /#catalogo com query. */
  basePath?: string;
}) {
  const trails =
    basePath === "/"
      ? TRAILS.map((t) => ({
          ...t,
          href: `/?objetivo=${encodeURIComponent(t.id)}#catalogo`,
        }))
      : TRAILS;

  return (
    <section className="border-b border-[var(--igh-border)] bg-[var(--card-bg)] py-10 sm:py-12" aria-labelledby="trilhas-objetivo-heading">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="trilhas-objetivo-heading" className="text-2xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-3xl">
            Por onde você quer começar?
          </h2>
          <p className="mt-2 text-sm text-[var(--igh-muted)] sm:text-base">
            Escolha um objetivo e veja cursos alinhados à sua jornada de formação profissional.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trails.map((trail) => (
            <a
              key={trail.id}
              href={trail.href}
              className="group flex flex-col rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-4 transition hover:border-[var(--igh-primary)]/50 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
            >
              <span className="text-base font-semibold text-[var(--igh-secondary)] group-hover:text-[var(--igh-primary)]">
                {trail.title}
              </span>
              <span className="mt-1 text-sm leading-snug text-[var(--igh-muted)]">{trail.description}</span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
