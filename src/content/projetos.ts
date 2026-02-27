export const projetosList = [
  {
    slug: "computadores-para-inclusao",
    title: "Computadores para Inclusão",
    shortDescription: "Recondicionamento de equipamentos de informática para doação a projetos de inclusão digital.",
    description: "O programa recebe computadores usados de empresas e cidadãos, recondiciona os equipamentos e os destina a escolas, telecentros e iniciativas de inclusão digital em todo o país.",
    highlights: ["Recondicionamento de equipamentos", "Doação a instituições", "Redução do lixo eletrônico"],
  },
  {
    slug: "crc",
    title: "CRC - Centro de Recondicionamento de Computadores",
    shortDescription: "Unidades físicas onde ocorrem a triagem, recondicionamento e destinação dos equipamentos.",
    description: "Os CRCs são espaços equipados para receber, testar, recondicionar e preparar computadores para doação. Funcionam em parceria com governos e organizações da sociedade civil.",
    highlights: ["Unidades em vários estados", "Capacitação de jovens", "Logística reversa"],
  },
  {
    slug: "doacoes-recebidas",
    title: "Doações Recebidas",
    shortDescription: "Transparência sobre doações de equipamentos e recursos recebidos pelo IGH.",
    description: "Registro público das doações de equipamentos de informática e de recursos que permitem a manutenção dos projetos e das formações oferecidas gratuitamente.",
    highlights: ["Prestação de contas", "Parceiros doadores", "Impacto documentado"],
  },
  {
    slug: "entregas",
    title: "Entregas",
    shortDescription: "Destinação dos equipamentos recondicionados a laboratórios e beneficiários.",
    description: "Os computadores recondicionados são entregues a escolas, telecentros, ONGs e projetos que promovem inclusão digital e educação tecnológica.",
    highlights: ["Laboratórios montados", "Comunidades atendidas", "Relatórios de entrega"],
  },
] as const;

export type ProjetoSlug = (typeof projetosList)[number]["slug"];

export function getProjetoBySlug(slug: string) {
  return projetosList.find((p) => p.slug === slug) ?? null;
}
