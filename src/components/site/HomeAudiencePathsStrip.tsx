import { Container } from "./Container";

/**
 * Faixa compacta logo após o hero: dois caminhos explícitos (candidato vs. aluno).
 */
export function HomeAudiencePathsStrip() {
  return (
    <div className="border-b border-[var(--igh-border)] bg-[var(--igh-surface)] py-3 sm:py-4">
      <Container>
        <nav
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6"
          aria-label="Caminhos para visitantes e alunos"
        >
          <a
            href="/inscreva"
            className="touch-manipulation rounded-lg border border-[var(--igh-primary)]/30 bg-[var(--card-bg)] px-4 py-3 text-center text-sm font-semibold text-[var(--igh-secondary)] shadow-sm transition hover:border-[var(--igh-primary)] hover:bg-[var(--igh-primary)]/8 sm:min-w-[200px] sm:py-3.5"
          >
            Quero me formar
            <span className="mt-0.5 block text-xs font-normal text-[var(--igh-muted)]">Inscrição e formações</span>
          </a>
          <span className="hidden text-[var(--igh-muted)] sm:inline" aria-hidden>
            ·
          </span>
          <a
            href="/login"
            className="touch-manipulation rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-4 py-3 text-center text-sm font-semibold text-[var(--igh-secondary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-surface)] sm:min-w-[200px] sm:py-3.5"
          >
            Já estudo no IGH
            <span className="mt-0.5 block text-xs font-normal text-[var(--igh-muted)]">Área do aluno</span>
          </a>
        </nav>
      </Container>
    </div>
  );
}
