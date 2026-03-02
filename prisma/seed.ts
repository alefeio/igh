/**
 * Seed do CMS do site institucional e dados iniciais.
 * Executar: npm run seed (ou npx prisma db seed)
 * Requer POSTGRES_URL / PRISMA_DATABASE_URL / DATABASE_URL no .env.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  // --- SiteSettings (um único registro) ---
  const settingsCount = await prisma.siteSettings.count();
  if (settingsCount === 0) {
    await prisma.siteSettings.create({
      data: {
        siteName: "Instituto Gustavo Hessel",
        contactEmail: "contato@igh.org.br",
        contactPhone: "(11) 1234-5678",
        contactWhatsapp: "",
        addressLine: "",
        addressCity: "Belém",
        addressState: "PA",
        addressZip: "",
        businessHours: "",
        seoTitleDefault: "Instituto Gustavo Hessel | Formação em tecnologia e inclusão digital",
        seoDescriptionDefault:
          "Formações gratuitas em programação, dados, UX/UI e mais. Inclusão digital e recondicionamento de computadores.",
      },
    });
    console.log("SiteSettings criado.");
  }

  // --- Menu: Início, Sobre, Formações, Projetos (com subitens), Notícias, Transparência, Contato ---
  const menuCount = await prisma.siteMenuItem.count();
  if (menuCount === 0) {
    const ordem = [
      { label: "Início", href: "/", order: 0 },
      { label: "Sobre", href: "/sobre", order: 1 },
      { label: "Formações", href: "/formacoes", order: 2 },
      { label: "Projetos", href: "/projetos", order: 3 },
      { label: "Notícias", href: "/noticias", order: 4 },
      { label: "Transparência", href: "/transparencia", order: 5 },
      { label: "Contato", href: "/contato", order: 6 },
    ];
    for (const item of ordem) {
      await prisma.siteMenuItem.create({ data: item });
    }
    const projetos = await prisma.siteMenuItem.findFirst({ where: { href: "/projetos" } });
    if (projetos) {
      const sub = [
        { label: "Computadores para Inclusão", href: "/projetos/computadores-para-inclusao", order: 0, parentId: projetos.id },
        { label: "CRC", href: "/projetos/crc", order: 1, parentId: projetos.id },
        { label: "Doações Recebidas", href: "/projetos/doacoes-recebidas", order: 2, parentId: projetos.id },
        { label: "Entregas", href: "/projetos/entregas", order: 3, parentId: projetos.id },
      ];
      for (const s of sub) {
        await prisma.siteMenuItem.create({ data: s });
      }
    }
    console.log("Menu criado (7 itens + 4 subitens de Projetos).");
  }

  // --- Cursos (garantir existência para vincular às formações) ---
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const courseNames = [
    "Programação Web",
    "Dados e IA",
    "UX/UI",
    "Marketing Digital",
    "Lógica de Programação",
    "HTML, CSS e JavaScript",
    "Back-end e Bancos de Dados",
  ];
  for (const name of courseNames) {
    const slug = slugify(name) || name.toLowerCase().replace(/\s+/g, "-");
    await prisma.course.upsert({
      where: { name },
      create: {
        name,
        slug,
        description: `Curso: ${name}. Conteúdo disponível no site.`,
        status: "ACTIVE",
      },
      update: {},
    });
  }
  console.log("Cursos garantidos.");

  // --- Formações (SiteFormation + vínculo com cursos existentes) ---
  const formationCount = await prisma.siteFormation.count();
  if (formationCount === 0) {
    const allCourses = await prisma.course.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
    const byName = (n: string) => allCourses.find((c) => c.name.toLowerCase().includes(n.toLowerCase()));
    const rest = () => allCourses.filter((c) => !usedIds.has(c.id));
    const usedIds = new Set<string>();
    const pick = (name: string): typeof allCourses[0] | undefined => {
      const found = byName(name);
      if (found) { usedIds.add(found.id); return found; }
      const r = rest()[0];
      if (r) { usedIds.add(r.id); return r; }
      return undefined;
    };

    const programacao = pick("Programação");
    const dados = pick("Dados");
    const ux = pick("UX");
    const marketing = pick("Marketing");

    const formations = [
      {
        title: "Programação",
        slug: "programacao",
        summary: "Desenvolvimento web e lógica de programação.",
        audience: "Quem quer desenvolver sites, sistemas e aplicações.",
        outcomes: ["Lógica de programação", "HTML, CSS e JavaScript", "Back-end e bancos de dados", "Versionamento (Git)"],
        finalProject: "Projeto de aplicação ou site publicado.",
        order: 0,
        courseIds: programacao ? [programacao.id] : [],
      },
      {
        title: "Dados e IA",
        slug: "dados-e-ia",
        summary: "Análise de dados, BI e introdução à inteligência artificial.",
        audience: "Quem quer analisar dados e trabalhar com inteligência artificial.",
        outcomes: ["Análise de dados e planilhas", "Visualização e dashboards", "Noções de BI", "Introdução à IA e ferramentas"],
        finalProject: "Projeto de análise ou relatório com dados reais.",
        order: 1,
        courseIds: dados ? [dados.id] : [],
      },
      {
        title: "UX/UI",
        slug: "ux-ui",
        summary: "Experiência e interface do usuário.",
        audience: "Quem quer desenhar experiências e interfaces digitais.",
        outcomes: ["Pesquisa com usuários", "Wireframes e protótipos", "Design de interfaces", "Ferramentas (Figma)"],
        finalProject: "Portfólio com projetos de UX/UI.",
        order: 2,
        courseIds: ux ? [ux.id] : [],
      },
      {
        title: "Marketing e Tráfego",
        slug: "marketing-trafego",
        summary: "Marketing digital, redes sociais e tráfego pago.",
        audience: "Quem quer atuar em marketing digital e mídias pagas.",
        outcomes: ["Marketing digital", "Redes sociais e conteúdo", "Tráfego pago (Meta, Google)", "Métricas e análise"],
        finalProject: "Campanha ou plano de marketing documentado.",
        order: 3,
        courseIds: marketing ? [marketing.id] : [],
      },
    ];

    for (const f of formations) {
      const formation = await prisma.siteFormation.create({
        data: {
          title: f.title,
          slug: f.slug,
          summary: f.summary,
          audience: f.audience,
          outcomes: f.outcomes,
          finalProject: f.finalProject,
          order: f.order,
        },
      });
      for (let i = 0; i < f.courseIds.length; i++) {
        await prisma.siteFormationCourse.create({
          data: {
            formationId: formation.id,
            courseId: f.courseIds[i],
            order: i,
          },
        });
      }
    }
    console.log("Formações criadas e vinculadas aos cursos.");
  }

  // --- Banners ---
  const bannerCount = await prisma.siteBanner.count();
  if (bannerCount === 0) {
    await prisma.siteBanner.create({
      data: {
        title: "Formação em tecnologia que transforma vidas",
        subtitle: "Cursos gratuitos em programação, dados, UX/UI e marketing digital.",
        ctaLabel: "Ver formações",
        ctaHref: "/formacoes",
        order: 0,
        isActive: true,
      },
    });
    console.log("Banner criado.");
  }

  // --- FAQ (conteúdo que estava em content/faq.ts) ---
  const faqCount = await prisma.siteFaqItem.count();
  if (faqCount === 0) {
    const faqs = [
      { question: "Quem pode se inscrever nas formações?", answer: "Qualquer pessoa com conhecimentos básicos de informática (uso de navegador, e-mail e editores de texto). Não é necessário ter formação prévia em tecnologia.", order: 0 },
      { question: "As formações são gratuitas?", answer: "Sim. O IGH oferece formações gratuitas com foco em inclusão digital e profissional, em parceria com instituições e programas de impacto social.", order: 1 },
      { question: "Como funciona a doação de equipamentos?", answer: "Empresas e pessoas podem doar computadores em desuso. O IGH recondiciona os equipamentos e os destina a laboratórios e alunos em situação de vulnerabilidade.", order: 2 },
      { question: "Onde as aulas são realizadas?", answer: "As turmas são realizadas em laboratórios parceiros ou em ambiente online, conforme a formação. As informações são enviadas no ato da matrícula.", order: 3 },
      { question: "Como acompanhar a transparência do IGH?", answer: "Na página Transparência você encontra editais, convênios, relatórios e documentos públicos. O IGH preza pela prestação de contas à sociedade.", order: 4 },
    ];
    for (const faq of faqs) {
      await prisma.siteFaqItem.create({ data: faq });
    }
    console.log("FAQ criado (5 itens).");
  }

  // --- Parceiros (conteúdo que estava em content/parceiros.ts) ---
  const partnerCount = await prisma.sitePartner.count();
  if (partnerCount === 0) {
    await prisma.sitePartner.createMany({
      data: [
        { name: "Parceiro 1", order: 0 },
        { name: "Parceiro 2", order: 1 },
        { name: "Parceiro 3", order: 2 },
        { name: "Parceiro 4", order: 3 },
        { name: "Parceiro 5", order: 4 },
      ],
    });
    console.log("Parceiros criados (5 itens).");
  }

  // --- Depoimentos (conteúdo que estava em content/depoimentos.ts) ---
  const testimonialCount = await prisma.siteTestimonial.count();
  if (testimonialCount === 0) {
    await prisma.siteTestimonial.createMany({
      data: [
        { name: "Maria Silva", roleOrContext: "Aluna - Trilha Programação", quote: "A formação mudou minha trajetória. Hoje trabalho com desenvolvimento.", order: 0 },
        { name: "João Santos", roleOrContext: "Aluno - Trilha Dados", quote: "Conteúdo atual e professores com experiência de mercado.", order: 1 },
        { name: "Ana Costa", roleOrContext: "Aluna - Trilha UX/UI", quote: "Estrutura excelente e projeto integrador para montar portfólio.", order: 2 },
      ],
    });
    console.log("Depoimentos criados (3 itens).");
  }

  // --- Projetos (conteúdo que estava em content/projetos.ts) ---
  const projectCount = await prisma.siteProject.count();
  if (projectCount === 0) {
    const projects = [
      { title: "Computadores para Inclusão", slug: "computadores-para-inclusao", summary: "Recondicionamento de equipamentos de informática para doação a projetos de inclusão digital.", content: "O programa recebe computadores usados de empresas e cidadãos, recondiciona os equipamentos e os destina a escolas, telecentros e iniciativas de inclusão digital em todo o país.", order: 0 },
      { title: "CRC - Centro de Recondicionamento de Computadores", slug: "crc", summary: "Unidades físicas onde ocorrem a triagem, recondicionamento e destinação dos equipamentos.", content: "Os CRCs são espaços equipados para receber, testar, recondicionar e preparar computadores para doação. Funcionam em parceria com governos e organizações da sociedade civil.", order: 1 },
      { title: "Doações Recebidas", slug: "doacoes-recebidas", summary: "Transparência sobre doações de equipamentos e recursos recebidos pelo IGH.", content: "Registro público das doações de equipamentos de informática e de recursos que permitem a manutenção dos projetos e das formações oferecidas gratuitamente.", order: 2 },
      { title: "Entregas", slug: "entregas", summary: "Destinação dos equipamentos recondicionados a laboratórios e beneficiários.", content: "Os computadores recondicionados são entregues a escolas, telecentros, ONGs e projetos que promovem inclusão digital e educação tecnológica.", order: 3 },
    ];
    for (const p of projects) {
      await prisma.siteProject.create({ data: p });
    }
    console.log("Projetos criados (4 itens).");
  }

  // --- Categorias de Notícias e Posts (conteúdo que estava em content/posts.ts) ---
  let catCursos: { id: string } | null = null;
  let catProjetos: { id: string } | null = null;
  let catEventos: { id: string } | null = null;
  let catParcerias: { id: string } | null = null;
  const newsCategoryCount = await prisma.siteNewsCategory.count();
  if (newsCategoryCount === 0) {
    const c1 = await prisma.siteNewsCategory.create({ data: { name: "Cursos", slug: "cursos", order: 0 } });
    const c2 = await prisma.siteNewsCategory.create({ data: { name: "Projetos", slug: "projetos", order: 1 } });
    const c3 = await prisma.siteNewsCategory.create({ data: { name: "Eventos", slug: "eventos", order: 2 } });
    const c4 = await prisma.siteNewsCategory.create({ data: { name: "Parcerias", slug: "parcerias", order: 3 } });
    catCursos = c1;
    catProjetos = c2;
    catEventos = c3;
    catParcerias = c4;
    console.log("Categorias de notícias criadas (4 itens).");
  } else {
    catCursos = await prisma.siteNewsCategory.findFirst({ where: { slug: "cursos" }, select: { id: true } });
    catProjetos = await prisma.siteNewsCategory.findFirst({ where: { slug: "projetos" }, select: { id: true } });
    catEventos = await prisma.siteNewsCategory.findFirst({ where: { slug: "eventos" }, select: { id: true } });
    catParcerias = await prisma.siteNewsCategory.findFirst({ where: { slug: "parcerias" }, select: { id: true } });
  }

  const newsPostCount = await prisma.siteNewsPost.count();
  if (newsPostCount === 0 && (catCursos || catProjetos || catEventos || catParcerias)) {
    const posts = [
      { title: "Nova turma de Programação abre inscrições em março", slug: "nova-turma-programacao-2025", excerpt: "Inscrições para a formação em Programação do IGH estarão abertas a partir do dia 3 de março. São 120 vagas com aulas presenciais.", categoryId: catCursos?.id ?? null, publishedAt: new Date("2025-02-20"), isPublished: true },
      { title: "Parceiro doa 500 computadores para recondicionamento", slug: "doacao-equipamentos-parceiro", excerpt: "Empresa parceira destinou equipamentos ao programa Computadores para Inclusão. Equipamentos serão recondicionados e doados a laboratórios.", categoryId: catProjetos?.id ?? null, publishedAt: new Date("2025-02-15"), isPublished: true },
      { title: "Demo Day da trilha de Dados reúne projetos de análise", slug: "demo-day-trilha-dados", excerpt: "Alunos da formação em Dados e BI apresentaram projetos de análise de dados e dashboards no Demo Day realizado no último sábado.", categoryId: catEventos?.id ?? null, publishedAt: new Date("2025-02-10"), isPublished: true },
      { title: "IGH firma parceria com prefeitura para capacitação", slug: "parceria-prefeitura-capacitacao", excerpt: "Acordo prevê oferta de formações gratuitas para jovens e adultos em situação de vulnerabilidade no município.", categoryId: catParcerias?.id ?? null, publishedAt: new Date("2025-02-05"), isPublished: true },
      { title: "Inscrições abertas para a trilha UX/UI", slug: "inscricoes-ux-ui-abertas", excerpt: "Formação em Experiência e Interface do usuário está com vagas abertas. Pré-requisito: Informática Básica.", categoryId: catCursos?.id ?? null, publishedAt: new Date("2025-01-28"), isPublished: true },
      { title: "Novo CRC inaugurado em estado da região Nordeste", slug: "crc-novo-estado", excerpt: "Centro de Recondicionamento de Computadores amplia atuação e passa a receber doações em mais um estado.", categoryId: catProjetos?.id ?? null, publishedAt: new Date("2025-01-22"), isPublished: true },
    ];
    for (const p of posts) {
      await prisma.siteNewsPost.create({ data: p });
    }
    console.log("Posts de notícias criados (6 itens).");
  }

  // --- Transparência: categorias e documentos (conteúdo que estava em content/transparencia.ts) ---
  let catEditais: { id: string } | null = null;
  let catConvenios: { id: string } | null = null;
  let catRelatorios: { id: string } | null = null;
  let catOutros: { id: string } | null = null;
  const transparencyCategoryCount = await prisma.siteTransparencyCategory.count();
  if (transparencyCategoryCount === 0) {
    catEditais = await prisma.siteTransparencyCategory.create({ data: { name: "Editais", slug: "editais", order: 0 } });
    catConvenios = await prisma.siteTransparencyCategory.create({ data: { name: "Convênios", slug: "convenios", order: 1 } });
    catRelatorios = await prisma.siteTransparencyCategory.create({ data: { name: "Relatórios", slug: "relatorios", order: 2 } });
    catOutros = await prisma.siteTransparencyCategory.create({ data: { name: "Outros", slug: "outros", order: 3 } });
    console.log("Categorias de transparência criadas (4 itens).");
  } else {
    catEditais = await prisma.siteTransparencyCategory.findFirst({ where: { slug: "editais" }, select: { id: true } });
    catConvenios = await prisma.siteTransparencyCategory.findFirst({ where: { slug: "convenios" }, select: { id: true } });
    catRelatorios = await prisma.siteTransparencyCategory.findFirst({ where: { slug: "relatorios" }, select: { id: true } });
    catOutros = await prisma.siteTransparencyCategory.findFirst({ where: { slug: "outros" }, select: { id: true } });
  }

  const transparencyDocCount = await prisma.siteTransparencyDocument.count();
  if (transparencyDocCount === 0 && catEditais && catConvenios && catRelatorios && catOutros) {
    const docs = [
      { categoryId: catEditais.id, title: "Edital de seleção de alunos - 2025/1", description: "Processo seletivo para as turmas do primeiro semestre de 2025.", date: new Date("2025-01-15"), fileUrl: "/docs/edital-2025-1.pdf" },
      { categoryId: catConvenios.id, title: "Convênio com instituição parceira - Termo de cooperação", description: "Termo de cooperação técnica para oferta de formações.", date: new Date("2024-12-10"), fileUrl: "/docs/convenio-parceiro.pdf" },
      { categoryId: catRelatorios.id, title: "Relatório de atividades - 2024", description: "Prestação de contas e resultados do ano de 2024.", date: new Date("2024-11-30"), fileUrl: "/docs/relatorio-2024.pdf" },
      { categoryId: catEditais.id, title: "Edital de doação de equipamentos", description: "Regras para doação de equipamentos ao programa Computadores para Inclusão.", date: new Date("2024-10-01"), fileUrl: "/docs/edital-doacao.pdf" },
      { categoryId: catRelatorios.id, title: "Prestação de contas - Projeto XYZ", description: "Demonstrativo de execução do projeto.", date: new Date("2024-09-15"), fileUrl: "/docs/prestacao-xyz.pdf" },
      { categoryId: catOutros.id, title: "Estatuto do IGH", description: "Estatuto social do Instituto Gustavo Hessel.", date: new Date("2020-05-20"), fileUrl: "/docs/estatuto.pdf" },
    ];
    for (const d of docs) {
      await prisma.siteTransparencyDocument.create({ data: d });
    }
    console.log("Documentos de transparência criados (6 itens).");
  }
}

main()
  .then(() => {
    console.log("Seed concluído.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
