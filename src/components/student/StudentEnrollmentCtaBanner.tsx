import Link from "next/link";
import { GraduationCap, ChevronRight } from "lucide-react";

type Props = {
  /** Turmas com vaga em /inscreva. Sem nenhuma, o banner só avisa que as inscrições vêm depois. */
  openClassGroupsCount: number;
  className?: string;
};

/** Chamada de inscrição no painel do aluno que ainda não tem matrícula. */
export function StudentEnrollmentCtaBanner({ openClassGroupsCount, className = "" }: Props) {
  const isOpen = openClassGroupsCount > 0;
  const optionsLabel =
    openClassGroupsCount === 1
      ? "1 turma com vaga disponível"
      : `${openClassGroupsCount} turmas com vagas disponíveis`;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-2 border-[var(--igh-primary)]/35 bg-gradient-to-br from-[var(--igh-primary)]/15 via-[var(--card-bg)] to-violet-500/10 p-5 shadow-md shadow-[var(--igh-primary)]/10 sm:p-7 ${className}`}
      aria-labelledby="inscricoes-heading"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--igh-primary)]/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--igh-primary)] text-white shadow-md shadow-[var(--igh-primary)]/30">
          <GraduationCap className="h-7 w-7" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--igh-primary)]">
            Novo ciclo
          </p>
          <h2
            id="inscricoes-heading"
            className="mt-1 text-xl font-bold text-[var(--text-primary)] sm:text-2xl"
          >
            {isOpen ? "Inscrições abertas para o novo ciclo" : "Inscrições do novo ciclo em breve"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            {isOpen
              ? `Escolha o curso e a turma que combinam com a sua rotina e garanta sua vaga. Hoje há ${optionsLabel}.`
              : "Assim que as turmas do novo ciclo forem abertas, a inscrição aparece aqui. Acompanhe também os avisos do Instituto."}
          </p>
        </div>
        {isOpen ? (
          <Link
            href="/inscreva"
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--igh-primary)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--igh-primary)]/25 transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:w-auto"
          >
            Inscreva-se
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
