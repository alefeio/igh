import { PageHeader, Section } from "@/components/site";
import { InscrevaForm } from "./InscrevaForm";

export const metadata = {
  title: "Inscreva-se",
  description: "Faça sua pré-matrícula nas formações do IGH. Escolha a turma e inscreva-se.",
};

export default function InscrevaPage() {
  return (
    <>
      <PageHeader
        title="Inscreva-se"
        subtitle="Faça sua pré-matrícula em uma das turmas disponíveis. Você pode fazer login se já tiver cadastro ou cadastrar-se com seus dados."
      />
      <Section>
        <div className="mx-auto max-w-xl">
          <InscrevaForm />
        </div>
      </Section>
    </>
  );
}
