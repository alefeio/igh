import { PageHeader, Section } from "@/components/site";

export const metadata = {
  title: "Sobre o IGH | Instituto Gustavo Hessel",
  description: "Conheça o Instituto Gustavo Hessel: missão e inclusão digital.",
};

export default function SobrePage() {
  return (
    <>
      <PageHeader title="Sobre o IGH" subtitle="Conheça nossa missão e nosso compromisso com a inclusão digital." />
      <Section>
        <div className="max-w-none text-[var(--igh-muted)] space-y-4">
          <p>O Instituto Gustavo Hessel (IGH) é uma organização dedicada à formação em tecnologia e à inclusão digital. Nossa missão é oferecer oportunidades de qualificação profissional em áreas como programação, dados, UX/UI e marketing digital.</p>
          <p>Além das formações, atuamos em projetos de recondicionamento de computadores, doação de equipamentos e montagem de laboratórios em parceria com instituições em todo o país.</p>
        </div>
      </Section>
    </>
  );
}
