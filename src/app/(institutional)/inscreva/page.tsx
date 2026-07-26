import { Suspense } from "react";
import { FAQ, PageHeader, Section } from "@/components/site";
import { enrollmentFaqItems } from "@/content";
import { getInscrevaPageForSite } from "@/lib/site-data";
import { InscrevaForm } from "./InscrevaForm";

export const metadata = {
  title: "Inscreva-se",
  description: "Faça sua pré-matrícula nas formações do IGH. Escolha a turma e inscreva-se.",
};

function InscrevaFormFallback() {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--igh-primary)] border-t-transparent" aria-hidden />
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      </div>
    </div>
  );
}

export default async function InscrevaPage() {
  const inscrevaPage = await getInscrevaPageForSite();
  const headerTitle = inscrevaPage?.title?.trim() || "Inscreva-se";
  const headerSubtitle = inscrevaPage?.subtitle?.trim() || "Escolha uma turma e faça sua pré-matrícula.";
  const headerImageUrl = inscrevaPage?.headerImageUrl?.trim() || null;

  return (
    <>
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        backgroundImageUrl={headerImageUrl}
        compact
      />
      <Section background="muted" className="min-h-[50vh]">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<InscrevaFormFallback />}>
            <InscrevaForm />
          </Suspense>
        </div>
      </Section>
      <FAQ items={enrollmentFaqItems} title="Dúvidas sobre a matrícula" />
    </>
  );
}
