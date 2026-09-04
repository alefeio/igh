import type { Metadata } from "next";

import { getTurnstileSiteKey } from "@/lib/bot-protection";
import { BRAND } from "@/lib/brand";
import { listCoursesFromPastCyclesForInterest } from "@/lib/next-cycle-interest";
import { Button, PageHeader, Section } from "@/components/site";

import { NextCycleInterestForm } from "./NextCycleInterestForm";

export const metadata: Metadata = {
  title: "Pré-inscrição — próximo ciclo",
  description: `Deixe seu interesse no próximo ciclo de formações do ${BRAND.shortName}. Sem cadastro obrigatório.`,
};

export default async function PreInscricaoPage() {
  const courses = await listCoursesFromPastCyclesForInterest();

  return (
    <>
      <PageHeader
        title="Pré-inscrição no próximo ciclo"
        subtitle={`Cadastre seu interesse para ser avisado quando as matrículas do próximo ciclo abrirem no ${BRAND.shortName}. Não é necessário criar conta.`}
      />
      <Section>
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div>
            <NextCycleInterestForm
              courses={courses}
              turnstileSiteKey={getTurnstileSiteKey()}
            />
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--igh-secondary)]">
                  Já tem cadastro conosco?
                </p>
                <p className="mt-0.5 text-xs text-[var(--igh-muted)]">
                  Faça login para acessar sua área do aluno. A pré-inscrição acima não exige conta.
                </p>
              </div>
              <Button
                as="link"
                href="/login?from=/pre-inscricao"
                variant="outline"
                className="shrink-0"
              >
                Fazer login
              </Button>
            </div>
          </div>

          <aside className="rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-5 text-sm text-[var(--igh-muted)] sm:p-6">
            <h2 className="text-base font-semibold text-[var(--igh-secondary)]">Como funciona</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Informe nome, telefone, e-mail e o curso de interesse.</li>
              <li>
                A lista inclui cursos que já tiveram turmas nos ciclos 1, 2 e 3. Se o seu não aparecer,
                escolha &quot;Outro&quot; e digite o nome.
              </li>
              <li>Não é obrigatório criar conta para enviar a pré-inscrição.</li>
              <li>
                Quando o próximo ciclo abrir, a equipe entrará em contato pelos dados informados.
              </li>
            </ul>
            <p className="mt-4">
              Quer ver o catálogo atual?{" "}
              <a
                href="/formacoes"
                className="font-medium text-[var(--igh-primary)] underline-offset-2 hover:underline"
              >
                Ver formações
              </a>
              .
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}
