import { Suspense } from "react";
import { FAQ, PageHeader, Section } from "@/components/site";
import { BRAND } from "@/lib/brand";
import { getFaqItems, getInscrevaPageForSite } from "@/lib/site-data";
import { InscrevaForm } from "./InscrevaForm";

export const metadata = {
  title: "Inscreva-se",
  description: `Faça sua pré-matrícula nas formações do ${BRAND.shortName}. Escolha a turma e inscreva-se.`,
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
  const [inscrevaPage, faqFromDb] = await Promise.all([getInscrevaPageForSite(), getFaqItems()]);
  const headerTitle = inscrevaPage?.title?.trim() || "";
  const headerSubtitle = inscrevaPage?.subtitle?.trim() || "";
  const headerImageUrl = inscrevaPage?.headerImageUrl?.trim() || null;
  const faqItems = faqFromDb.map((i) => ({ pergunta: i.question, resposta: i.answer }));

  return (
    <>
      {(headerTitle || headerSubtitle || headerImageUrl) && (
        <PageHeader
          title={headerTitle}
          subtitle={headerSubtitle || undefined}
          backgroundImageUrl={headerImageUrl}
          compact
        />
      )}
      <Section background="muted" className="min-h-[50vh]">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<InscrevaFormFallback />}>
            <InscrevaForm />
          </Suspense>
        </div>
      </Section>
      {faqItems.length > 0 && <FAQ items={faqItems} title="Dúvidas sobre a matrícula" />}
    </>
  );
}
