import { Suspense } from "react";
import { PageHeader, Section } from "@/components/site";
import { InscrevaForm } from "./InscrevaForm";

export const metadata = {
  title: "Inscreva-se",
  description: "Faça sua pré-matrícula nas formações do IGH. Escolha a turma e inscreva-se.",
};

function InscrevaFormFallback() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-[var(--igh-muted)]">
      Carregando...
    </div>
  );
}

export default function InscrevaPage() {
  return (
    <>
      <PageHeader
        title="Inscreva-se"
        subtitle="Faça sua pré-matrícula em uma das turmas disponíveis. Você pode fazer login se já tiver cadastro ou cadastrar-se com seus dados."
      />
      <Section>
        <div className="mx-auto max-w-xl">
          <Suspense fallback={<InscrevaFormFallback />}>
            <InscrevaForm />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
