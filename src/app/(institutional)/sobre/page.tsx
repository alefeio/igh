import { PageHeader, Section } from "@/components/site";
import { BRAND } from "@/lib/brand";
import { getAboutForSite } from "@/lib/site-data";

export const metadata = {
  title: `Sobre o ${BRAND.shortName} | ${BRAND.legalName}`,
  description: `Conheça o ${BRAND.legalName}: formação profissional gratuita em tecnologia, inclusão digital, projetos, comunidade e transparência.`,
};

export default async function SobrePage() {
  const about = await getAboutForSite();
  const title = about?.title?.trim() || "";
  const subtitle = about?.subtitle?.trim() || "";
  const content = about?.content?.trim() || "";
  const imageUrl = about?.imageUrl?.trim() || null;

  if (!title && !subtitle && !content && !imageUrl) {
    return null;
  }

  return (
    <>
      {(title || subtitle || imageUrl) && (
        <PageHeader title={title} subtitle={subtitle || undefined} backgroundImageUrl={imageUrl} />
      )}
      {content ? (
        <Section>
          <div
            className="prose prose-lg max-w-none text-[var(--igh-muted)] [&_a]:font-medium [&_a]:text-[var(--igh-primary)] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-90 [&_h2]:mt-8 [&_h2]:text-[var(--igh-secondary)] [&_li]:mb-2 [&_p]:mb-4 [&_ul]:my-4"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </Section>
      ) : null}
    </>
  );
}
