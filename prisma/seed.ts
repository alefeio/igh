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
    await prisma.course.upsert({
      where: { name },
      create: {
        name,
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
