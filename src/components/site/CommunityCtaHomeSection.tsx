import { MessageCircle, Sparkles, Users } from "lucide-react";

import { Container } from "./Container";
import { Button } from "./Button";

export function CommunityCtaHomeSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[var(--igh-secondary-solid)] via-[#1e3a5f] to-[var(--igh-primary)] py-14 text-white sm:py-20">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"
        aria-hidden
      />
      <Container>
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Comunidade IGH · PII
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Conecte-se, compartilhe ideias e inove com alunos de todos os cursos
            </h2>
            <p className="mt-4 text-lg text-white/90">
              A Comunidade IGH é o espaço do Projeto de Integração e Inovação: publique ideias, encontre parceiros para
              equipes multidisciplinares e participe de debates — mesmo antes de entrar em uma turma.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/85">
              <li className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Fórum aberto para quem tem cadastro no portal
              </li>
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Tags para organizar ideias, equipes e debates
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Professores e equipe IGH participam das conversas
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                as="link"
                href="/cadastro?from=%2Fcomunidade"
                variant="primary"
                size="lg"
                className="!bg-white !text-[var(--igh-secondary-solid)] hover:!bg-white/90"
              >
                Criar conta gratuita
              </Button>
              <Button
                as="link"
                href="/login?from=%2Fcomunidade"
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white/10"
              >
                Já tenho conta — entrar
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Como começar</p>
            <ol className="mt-4 space-y-4 text-sm text-white/90">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                  1
                </span>
                <span>Cadastre-se no portal com nome, e-mail e senha.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                  2
                </span>
                <span>Acesse a Comunidade IGH no menu após o login.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                  3
                </span>
                <span>Publique sua ideia, marque tags e converse com a rede IGH.</span>
              </li>
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}
