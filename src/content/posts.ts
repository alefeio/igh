export type PostCategory = "Cursos" | "Projetos" | "Eventos" | "Parcerias";

export const postCategories: PostCategory[] = ["Cursos", "Projetos", "Eventos", "Parcerias"];

export const posts = [
  {
    slug: "nova-turma-programacao-2025",
    title: "Nova turma de Programação abre inscrições em março",
    excerpt: "Inscrições para a formação em Programação do IGH estarão abertas a partir do dia 3 de março. São 120 vagas com aulas presenciais.",
    category: "Cursos" as PostCategory,
    date: "2025-02-20",
    image: "/images/noticias/placeholder-programacao.jpg",
  },
  {
    slug: "doacao-equipamentos-parceiro",
    title: "Parceiro doa 500 computadores para recondicionamento",
    excerpt: "Empresa parceira destinou equipamentos ao programa Computadores para Inclusão. Equipamentos serão recondicionados e doados a laboratórios.",
    category: "Projetos" as PostCategory,
    date: "2025-02-15",
    image: "/images/noticias/placeholder-doacao.jpg",
  },
  {
    slug: "demo-day-trilha-dados",
    title: "Demo Day da trilha de Dados reúne projetos de análise",
    excerpt: "Alunos da formação em Dados e BI apresentaram projetos de análise de dados e dashboards no Demo Day realizado no último sábado.",
    category: "Eventos" as PostCategory,
    date: "2025-02-10",
    image: "/images/noticias/placeholder-demo.jpg",
  },
  {
    slug: "parceria-prefeitura-capacitacao",
    title: "IGH firma parceria com prefeitura para capacitação",
    excerpt: "Acordo prevê oferta de formações gratuitas para jovens e adultos em situação de vulnerabilidade no município.",
    category: "Parcerias" as PostCategory,
    date: "2025-02-05",
    image: "/images/noticias/placeholder-parceria.jpg",
  },
  {
    slug: "inscricoes-ux-ui-abertas",
    title: "Inscrições abertas para a trilha UX/UI",
    excerpt: "Formação em Experiência e Interface do usuário está com vagas abertas. Pré-requisito: Informática Básica.",
    category: "Cursos" as PostCategory,
    date: "2025-01-28",
    image: "/images/noticias/placeholder-ux.jpg",
  },
  {
    slug: "crc-novo-estado",
    title: "Novo CRC inaugurado em estado da região Nordeste",
    excerpt: "Centro de Recondicionamento de Computadores amplia atuação e passa a receber doações em mais um estado.",
    category: "Projetos" as PostCategory,
    date: "2025-01-22",
    image: "/images/noticias/placeholder-crc.jpg",
  },
] as const;

export function getPostBySlug(slug: string) {
  return posts.find((p) => p.slug === slug) ?? null;
}

export function getAllSlugs() {
  return posts.map((p) => p.slug);
}
