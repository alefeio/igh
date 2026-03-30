import { redirect } from "next/navigation";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { getSessionUserFromCookie } from "@/lib/auth";

import { NotificacoesClient } from "./NotificacoesClient";

export const metadata = {
  title: "Notificações",
  description: "Alertas da plataforma sobre suas turmas, aulas e atividades.",
};

export default async function NotificacoesPage() {
  const user = await getSessionUserFromCookie();
  if (!user) redirect("/login");

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Conta"
        title="Notificações"
        description="Resumo do que precisa da sua atenção (aulas liberadas, mudanças na turma, documentos, gamificação e fórum)."
      />
      <SectionCard title="Suas notificações" variant="elevated">
        <NotificacoesClient />
      </SectionCard>
    </div>
  );
}
