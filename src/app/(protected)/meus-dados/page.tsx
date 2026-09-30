import { redirect } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { ReferralShareCard } from "@/components/referral/ReferralShareCard";
import { getSessionUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmployeeSelfProfileForm } from "@/components/colaborador/EmployeeSelfProfileForm";
import { MeusDadosContaForm } from "./MeusDadosContaForm";
import { MeusDadosForm } from "./MeusDadosForm";
import { MeusDadosIdentidade } from "./MeusDadosIdentidade";
import { MeusDadosSenhaForm } from "./MeusDadosSenhaForm";

export const metadata = {
  title: "Meus dados",
  description: "Atualize seu cadastro e seus dados de acesso.",
};

const STAFF_ROLES = [
  "MASTER",
  "GENERAL_ADMIN",
  "ADMIN",
  "SITE_ADMIN",
  "POLO_COORDINATOR",
  "TEACHER",
] as const;

export default async function MeusDadosPage() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    redirect("/login");
  }

  const employee = await prisma.employee.findFirst({
    where: { userId: user.id, deletedAt: null, status: { not: "DESLIGADO" } },
    select: { id: true },
  });
  const isStudent = user.role === "STUDENT";
  const isStaff = (STAFF_ROLES as readonly string[]).includes(user.role);

  if (!isStudent && !isStaff && !employee) {
    redirect("/dashboard");
  }

  const roleLabel =
    user.role === "MASTER"
      ? "Master"
      : user.role === "GENERAL_ADMIN"
        ? "Administrador Geral"
        : user.role === "ADMIN"
          ? "Administrador Pedagógico"
          : user.role === "SITE_ADMIN"
            ? "Administrador Site"
            : user.role === "POLO_COORDINATOR"
              ? "Coordenador de Polos"
              : user.role === "TEACHER"
                ? "Professor"
                : null;

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow={isStudent ? "Aluno" : "Conta"}
        title="Meus dados"
        description={
          employee
            ? "Foto, nascimento, assinatura, dados pessoais, MEI, conta bancária, Pix e endereço."
            : isStudent
              ? "Complete seu cadastro com os dados restantes e anexe documento de identidade e comprovante de residência."
              : "Atualize foto, data de nascimento, assinatura, nome, e-mail e telefone."
        }
      />
      {!isStudent || employee ? (
        <SectionCard
          title="Perfil"
          description="Foto, data de nascimento e assinatura do certificado, quando houver perfil de professor."
          variant="elevated"
        >
          <MeusDadosIdentidade />
        </SectionCard>
      ) : null}
      {isStudent ? (
        <SectionCard
          title="Cadastro e documentos"
          description="Preencha os campos obrigatórios e envie os arquivos solicitados."
          variant="elevated"
        >
          <MeusDadosForm />
        </SectionCard>
      ) : null}
      {employee ? (
        <SectionCard
          title="Ficha do colaborador"
          description="Dados pessoais, MEI, conta bancária, Pix e endereço."
          variant="elevated"
        >
          <EmployeeSelfProfileForm />
        </SectionCard>
      ) : isStaff && roleLabel ? (
        <SectionCard
          title="Dados da conta"
          description="As alterações valem para o login e para a exibição do seu nome na plataforma."
          variant="elevated"
        >
          <MeusDadosContaForm roleLabel={roleLabel} />
        </SectionCard>
      ) : null}
      <SectionCard
        title="Indicar amigos"
        description={
          isStudent
            ? "Gere e compartilhe seu link único de indicação."
            : "Gere e compartilhe seu link único de indicação (qualquer perfil pode indicar)."
        }
        variant="elevated"
      >
        <ReferralShareCard />
      </SectionCard>
      <SectionCard
        title="Senha de acesso"
        description={
          isStudent
            ? "Altere a senha usada para entrar com e-mail ou CPF."
            : "Altere a senha usada para entrar na plataforma."
        }
        variant="elevated"
      >
        <MeusDadosSenhaForm />
      </SectionCard>
    </div>
  );
}
