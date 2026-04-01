import type { ReactNode } from "react";
import { Section } from "./Section";
import { Card } from "./Card";

const items: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Aulas e progresso",
    body: "Acompanhe módulos, materiais e seu avanço na trilha, com tudo organizado no mesmo lugar.",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8M8 11h6" />
      </svg>
    ),
  },
  {
    title: "Fórum e dúvidas",
    body: "Tire dúvidas com colegas e monitores em espaços de discussão ligados ao curso.",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: "Gamificação e ranking",
    body: "Participe de desafios e veja como a turma se destaca — motivação extra para seguir firme.",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
  },
  {
    title: "Notificações",
    body: "Receba avisos sobre prazos, novidades da turma e atividades importantes.",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    title: "Calendário e frequência",
    body: "Organize aulas e presença com visão clara do que vem pela frente.",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    title: "Sua opinião importa",
    body: "Periodicamente você pode avaliar plataforma, aulas e apoio — isso ajuda a melhorar para todos.",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

/**
 * Secção institucional: como é estudar no IGH na prática (experiência digital).
 */
export function HomeStudentJourneySection() {
  return (
    <Section
      id="experiencia-plataforma"
      title="Como você estuda no IGH"
      subtitle="Formação presencial e híbrida com apoio digital: aulas, fórum, ranking, avisos e calendário num só ambiente."
      background="muted"
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title} as="article" className="flex flex-col gap-3 p-5 sm:p-6">
            <div className="text-[var(--igh-primary)]">{item.icon}</div>
            <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">{item.title}</h3>
            <p className="text-sm leading-relaxed text-[var(--igh-muted)]">{item.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
