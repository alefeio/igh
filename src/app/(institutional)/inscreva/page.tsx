import { Suspense } from "react";
import { PageHeader, Section } from "@/components/site";
import { getInscrevaPageForSite } from "@/lib/site-data";
import { InscrevaForm } from "./InscrevaForm";

export const metadata = {
  title: "Inscreva-se",
  description: "Faça sua pré-matrícula nas formações do IGH. Escolha a turma e inscreva-se.",
};

function InscrevaFormFallback() {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center text-[var(--text-muted)] shadow-sm">
      Carregando...
    </div>
  );
}

export default async function InscrevaPage() {
  const inscrevaPage = await getInscrevaPageForSite();
  const headerTitle = inscrevaPage?.title?.trim() || "Inscreva-se";
  const headerSubtitle = inscrevaPage?.subtitle?.trim() || "Faça sua pré-matrícula em uma das turmas disponíveis. Você pode fazer login se já tiver cadastro ou cadastrar-se com seus dados.";
  const headerImageUrl = inscrevaPage?.headerImageUrl?.trim() || null;

  return (
    <>
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        backgroundImageUrl={headerImageUrl}
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
