import { ComunidadePublicPage } from "@/components/community/ComunidadePublicPage";
import { getSessionUserFromCookie } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: BRAND.communityName,
  description: `Comunidade aberta do Projeto de Integração e Inovação (PII): ideias, equipes e debates entre cursos do ${BRAND.legalName}.`,
};

export default async function ComunidadePage() {
  const session = await getSessionUserFromCookie();

  return (
    <ComunidadePublicPage
      sessionUser={session ? { id: session.id, name: session.name, role: session.role } : null}
    />
  );
}
