import { BRAND } from "@/lib/brand";
import { Button } from "./Button";
import { Container } from "./Container";

/**
 * Chamada destacada na home para a pré-inscrição do próximo ciclo.
 */
export function HomeNextCycleInterestSection() {
  return (
    <section
      className="border-b border-[var(--igh-border)] bg-gradient-to-br from-[var(--igh-accent)]/15 via-[var(--igh-surface)] to-[var(--igh-primary)]/10 py-10 sm:py-12"
      aria-labelledby="home-pre-inscricao-heading"
    >
      <Container>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center sm:gap-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--igh-accent)]">
            Próximo ciclo
          </p>
          <h2
            id="home-pre-inscricao-heading"
            className="text-2xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-3xl"
          >
            Pré-inscrição para o próximo ciclo
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--igh-muted)] sm:text-base">
            Ainda não abriu a matrícula? Deixe seu interesse com nome, telefone, e-mail e o curso
            pretendido. Não é obrigatório criar conta — o {BRAND.shortName} avisa quando as turmas
            abrirem.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button as="link" href="/pre-inscricao" variant="accent" size="lg">
              Fazer pré-inscrição
            </Button>
            <Button as="link" href="/inscreva" variant="outline" size="lg">
              Já há turmas abertas? Inscreva-se
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
