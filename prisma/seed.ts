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
        contactPhone: "",
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

  // --- Menu (itens principais) ---
  const menuCount = await prisma.siteMenuItem.count();
  if (menuCount === 0) {
    const items = [
      { label: "Início", href: "/", order: 0 },
      { label: "Formações", href: "/formacoes", order: 1 },
      { label: "Projetos", href: "/projetos", order: 2 },
      { label: "Notícias", href: "/noticias", order: 3 },
      { label: "Contato", href: "/contato", order: 4 },
    ];
    for (const item of items) {
      await prisma.siteMenuItem.create({ data: item });
    }
    console.log("Menu criado.");
  }

  // --- Cursos (para vincular às formações) ---
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

  // --- Formações (SiteFormation + vínculo com cursos) ---
  const formationCount = await prisma.siteFormation.count();
  if (formationCount === 0) {
    const programacao = await prisma.course.findUnique({ where: { name: "Programação Web" } });
    const dados = await prisma.course.findUnique({ where: { name: "Dados e IA" } });
    const ux = await prisma.course.findUnique({ where: { name: "UX/UI" } });
    const marketing = await prisma.course.findUnique({ where: { name: "Marketing Digital" } });

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
    console.log("Formações criadas.");
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

  // --- FAQ ---
  const faqCount = await prisma.siteFaqItem.count();
  if (faqCount === 0) {
    const faqs = [
      { question: "As formações são gratuitas?", answer: "Sim. Todas as formações do IGH são gratuitas.", order: 0 },
      { question: "Qual o pré-requisito?", answer: "Informática básica e interesse em tecnologia.", order: 1 },
      { question: "Como me inscrevo?", answer: "Acesse a página de Contato e preencha o formulário de interesse.", order: 2 },
    ];
    for (const faq of faqs) {
      await prisma.siteFaqItem.create({ data: faq });
    }
    console.log("FAQ criado.");
  }

  // --- Parceiros (placeholders) ---
  const partnerCount = await prisma.sitePartner.count();
  if (partnerCount === 0) {
    await prisma.sitePartner.createMany({
      data: [
        { name: "Parceiro 1", order: 0 },
        { name: "Parceiro 2", order: 1 },
        { name: "Parceiro 3", order: 2 },
      ],
    });
    console.log("Parceiros criados.");
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
