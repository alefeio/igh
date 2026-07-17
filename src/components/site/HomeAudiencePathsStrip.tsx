import { Container } from "./Container";

/**
 * Faixa compacta logo após o hero: caminho principal (inscrição) + atalho para quem já é aluno.
 */
export function HomeAudiencePathsStrip() {
  return (
    <div className="border-b border-[var(--igh-border)] bg-[var(--igh-surface)] py-3 sm:py-4">
      <Container>
        <nav
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4"
          aria-label="Caminhos para visitantes e alunos"
        >
          <a
            href="/inscreva"
            className="touch-manipulation rounded-lg bg-[var(--igh-primary)] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--igh-primary-hover)] sm:min-w-[220px] sm:py-3.5"
          >
            Quero me formar
            <span className="mt-0.5 block text-xs font-normal text-white/90">Inscreva-se em uma formação</span>
          </a>
          <a
            href="/formacoes"
            className="touch-manipulation rounded-lg border border-[var(--igh-primary)]/35 bg-[var(--card-bg)] px-4 py-3 text-center text-sm font-semibold text-[var(--igh-secondary)] shadow-sm transition hover:border-[var(--igh-primary)] hover:bg-[var(--igh-primary)]/8 sm:min-w-[200px] sm:py-3.5"
          >
            Ver catálogo
            <span className="mt-0.5 block text-xs font-normal text-[var(--igh-muted)]">Explorar cursos</span>
          </a>
          <a
            href="/login"
            className="touch-manipulation rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-4 py-3 text-center text-sm font-medium text-[var(--igh-muted)] transition hover:border-[var(--igh-primary)]/40 hover:text-[var(--igh-secondary)] sm:min-w-[180px] sm:py-3.5"
          >
            Já estudo no IGH
            <span className="mt-0.5 block text-xs font-normal">Entrar na área do aluno</span>
          </a>
        </nav>
      </Container>
    </div>
  );
}
