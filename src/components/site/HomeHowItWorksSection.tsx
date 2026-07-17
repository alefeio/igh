import { Section } from "./Section";
import { Button } from "./Button";

const STEPS = [
  {
    n: "1",
    title: "Assista",
    body: "Aulas e materiais da trilha, no seu ritmo, com progresso salvo.",
  },
  {
    n: "2",
    title: "Pratique",
    body: "Exercícios e atividades para aplicar o que aprendeu.",
  },
  {
    n: "3",
    title: "Revise",
    body: "Volte ao conteúdo, anotações e trechos destacados quando precisar.",
  },
  {
    n: "4",
    title: "Conclua",
    body: "Feche módulos e aulas com clareza do que falta no percurso.",
  },
  {
    n: "5",
    title: "Certifique",
    body: "Ao concluir a formação elegível, emita seu certificado.",
  },
] as const;

/**
 * Percurso pedagógico em 5 passos (homepage learner-first).
 */
export function HomeHowItWorksSection() {
  return (
    <Section
      id="como-funciona"
      title="Como funciona"
      subtitle="Da primeira aula ao certificado: um caminho claro de formação profissional."
      background="muted"
    >
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="relative flex flex-col rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-4 sm:p-5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--igh-primary)] text-sm font-bold text-white">
              {step.n}
            </span>
            <h3 className="mt-3 text-base font-semibold text-[var(--igh-secondary)]">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--igh-muted)]">{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 text-center">
        <Button as="link" href="/inscreva" variant="primary" size="lg">
          Quero me inscrever
        </Button>
      </div>
    </Section>
  );
}
