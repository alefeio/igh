import { Container } from "@/components/site/Container";
import { RichTextViewer } from "@/components/ui/RichTextViewer";
import { getPublishedLegalVersion } from "@/lib/legal-documents";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Política de privacidade",
};

export default async function PrivacidadePage() {
  const doc = await getPublishedLegalVersion("PRIVACY");
  if (!doc) {
    return (
      <Container className="py-12">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Política de privacidade</h1>
        <p className="mt-4 text-[var(--text-muted)]">Nenhuma versão publicada no momento.</p>
      </Container>
    );
  }

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">
        {doc.title.trim() || "Política de privacidade"}
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Versão {doc.versionLabel} · Publicado em {new Date(doc.publishedAt).toLocaleDateString("pt-BR")}
      </p>
      <div className="prose prose-zinc mt-8 max-w-none dark:prose-invert">
        <RichTextViewer content={doc.contentRich} className="text-[var(--text-primary)]" />
      </div>
    </Container>
  );
}
