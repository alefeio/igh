import { Section } from "./Section";
import { Card } from "./Card";

type Depoimento = { nome: string; role: string; texto: string; avatar?: string };

export function Testimonials({ title = "O que dizem nossos alunos", items }: { title?: string; items: readonly Depoimento[] }) {
  return (
    <Section title={title} background="muted">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d, i) => (
          <Card key={i} as="article">
            <p className="text-[var(--igh-secondary)]">&ldquo;{d.texto}&rdquo;</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[var(--igh-surface)]" aria-hidden />
              <div>
                <p className="font-semibold text-[var(--igh-secondary)]">{d.nome}</p>
                <p className="text-sm text-[var(--igh-muted)]">{d.role}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
