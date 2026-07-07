import { ComunidadeTopicPublicPage } from "@/components/community/ComunidadePublicPage";
import { getSessionUserFromCookie } from "@/lib/auth";

type Props = {
  params: Promise<{ topicId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { topicId } = await params;
  return {
    title: "Discussão na Comunidade IGH",
    description: `Tópico da Comunidade IGH (PII) · ${topicId}`,
  };
}

export default async function ComunidadeTopicPage({ params }: Props) {
  const { topicId } = await params;
  const session = await getSessionUserFromCookie();

  return (
    <ComunidadeTopicPublicPage
      topicId={topicId}
      sessionUser={session ? { id: session.id, name: session.name, role: session.role } : null}
    />
  );
}
