import { Section } from "@/components/site";
import { BRAND } from "@/lib/brand";
import { TurmaInviteForm } from "./TurmaInviteForm";

export const metadata = {
  title: "Inscrição na turma",
  description: `Matrícula rápida em turma do ${BRAND.shortName}.`,
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function TurmaInvitePage({ params }: PageProps) {
  const { token } = await params;

  return (
    <Section background="muted" className="min-h-[50vh]">
      <TurmaInviteForm token={token} />
    </Section>
  );
}
