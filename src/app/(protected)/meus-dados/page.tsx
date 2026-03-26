import { redirect } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { getSessionUserFromCookie } from "@/lib/auth";
import { MeusDadosContaForm } from "./MeusDadosContaForm";
import { MeusDadosForm } from "./MeusDadosForm";

export const metadata = {
  title: "Meus dados",
  description: "Atualize seu cadastro e seus dados de acesso.",
};

const STAFF_ROLE_LABEL: Record<"MASTER" | "ADMIN" | "TEACHER", string> = {
  MASTER: "Master",
  ADMIN: "Administrador",
  TEACHER: "Professor",
};

export default async function MeusDadosPage() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    redirect("/login");
  }

  if (user.role === "STUDENT") {
    return (
      <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
        <DashboardHero
          eyebrow="Aluno"
          title="Meus dados"
          description="Complete seu cadastro com os dados restantes e anexe documento de identidade e comprovante de residência."
        />
        <SectionCard
          title="Cadastro e documentos"
          description="Preencha os campos obrigatórios e envie os arquivos solicitados."
          variant="elevated"
        >
          <MeusDadosForm />
        </SectionCard>
      </div>
    );
  }

  if (user.role === "MASTER" || user.role === "ADMIN" || user.role === "TEACHER") {
    const roleLabel = STAFF_ROLE_LABEL[user.role];
    return (
      <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
        <DashboardHero
          eyebrow="Conta"
          title="Meus dados"
          description="Atualize seu nome, e-mail de acesso e, se for professor, o telefone de contato."
        />
        <SectionCard
          title="Dados da conta"
          description="As alterações valem para o login e para a exibição do seu nome na plataforma."
          variant="elevated"
        >
          <MeusDadosContaForm roleLabel={roleLabel} />
        </SectionCard>
      </div>
    );
  }

  redirect("/dashboard");
}
