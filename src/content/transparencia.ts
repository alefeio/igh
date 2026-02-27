export type CategoriaDocumento = "Editais" | "Convênios" | "Relatórios" | "Outros";

export const categoriasTransparencia: CategoriaDocumento[] = ["Editais", "Convênios", "Relatórios", "Outros"];

export const documentos = [
  { id: "1", titulo: "Edital de seleção de alunos - 2025/1", data: "2025-01-15", categoria: "Editais" as CategoriaDocumento, descricao: "Processo seletivo para as turmas do primeiro semestre de 2025.", arquivo: "/docs/edital-2025-1.pdf" },
  { id: "2", titulo: "Convênio com instituição parceira - Termo de cooperação", data: "2024-12-10", categoria: "Convênios" as CategoriaDocumento, descricao: "Termo de cooperação técnica para oferta de formações.", arquivo: "/docs/convenio-parceiro.pdf" },
  { id: "3", titulo: "Relatório de atividades - 2024", data: "2024-11-30", categoria: "Relatórios" as CategoriaDocumento, descricao: "Prestação de contas e resultados do ano de 2024.", arquivo: "/docs/relatorio-2024.pdf" },
  { id: "4", titulo: "Edital de doação de equipamentos", data: "2024-10-01", categoria: "Editais" as CategoriaDocumento, descricao: "Regras para doação de equipamentos ao programa Computadores para Inclusão.", arquivo: "/docs/edital-doacao.pdf" },
  { id: "5", titulo: "Prestação de contas - Projeto XYZ", data: "2024-09-15", categoria: "Relatórios" as CategoriaDocumento, descricao: "Demonstrativo de execução do projeto.", arquivo: "/docs/prestacao-xyz.pdf" },
  { id: "6", titulo: "Estatuto do IGH", data: "2020-05-20", categoria: "Outros" as CategoriaDocumento, descricao: "Estatuto social do Instituto Gustavo Hessel.", arquivo: "/docs/estatuto.pdf" },
];
