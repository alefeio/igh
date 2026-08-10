/** Itens padrão do checklist de visita técnica (referência igh-termos). */
export const DEFAULT_TECHNICAL_VISIT_CHECKLIST = [
  { key: "COMPUTADORES", label: "Computadores", standard: "Padrão: 20 unidades" },
  { key: "BANCADAS", label: "Bancadas", standard: "Padrão: MDF na cor madeira" },
  { key: "TOMADAS", label: "Tomadas", standard: "Padrão: 20 unidades" },
  { key: "CLIMATIZACAO", label: "Climatização", standard: "Padrão: Sala climatizada" },
  { key: "REDE_ELETRICA", label: "Rede elétrica", standard: "Padrão: Adequada para 20 computadores" },
  { key: "INTERNET", label: "Internet", standard: "Padrão: Estável e adequada" },
  {
    key: "ILUMINACAO_VENTILACAO",
    label: "Iluminação e ventilação",
    standard: "Padrão: Adequadas",
  },
  { key: "SEGURANCA", label: "Segurança", standard: "Padrão: Adequada" },
  {
    key: "ESTRUTURA_FISICA",
    label: "Estrutura física",
    standard: "Padrão: Pintura, piso e instalações em boas condições",
  },
] as const;

export const DEFAULT_STRUCTURAL_STANDARDS = [
  "20 computadores",
  "Bancadas em MDF com canaleta",
  "20 tomadas duplas distribuídas pela sala",
  "Sala climatizada, com ar-condicionado em pleno funcionamento",
  "20 alunos por turma",
].join("\n");
