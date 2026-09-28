import { PageHeader, Section } from "@/components/site";
import { AvaliacaoAtendimentoForm } from "./AvaliacaoAtendimentoForm";

export default function AvaliarAtendimentoPage() {
  return (
    <>
      <PageHeader
        title="Avalie o atendimento"
        subtitle="Leva menos de um minuto. Só a nota e o canal do atendimento são obrigatórios."
      />
      <Section>
        <div className="mx-auto max-w-2xl">
          <AvaliacaoAtendimentoForm />
        </div>
      </Section>
    </>
  );
}
