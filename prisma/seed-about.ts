/**
 * Publica o conteúdo padrão da página Sobre no banco (tabela SiteAboutPage).
 * Atualiza o registro mais recente ou cria um novo se não houver nenhum.
 *
 * Executar: npm run seed:about
 */
import "./load-env";
import { ABOUT_PAGE_DEFAULT } from "../src/content/about";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$connect();

  const existing = await prisma.siteAboutPage.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true, imageUrl: true },
  });

  if (existing) {
    await prisma.siteAboutPage.update({
      where: { id: existing.id },
      data: {
        title: ABOUT_PAGE_DEFAULT.title,
        subtitle: ABOUT_PAGE_DEFAULT.subtitle,
        content: ABOUT_PAGE_DEFAULT.content,
        // Mantém a foto já cadastrada no Admin.
        imageUrl: existing.imageUrl,
      },
    });
    console.log("Página Sobre atualizada a partir do repositório.");
  } else {
    await prisma.siteAboutPage.create({
      data: {
        title: ABOUT_PAGE_DEFAULT.title,
        subtitle: ABOUT_PAGE_DEFAULT.subtitle,
        content: ABOUT_PAGE_DEFAULT.content,
      },
    });
    console.log("Página Sobre criada a partir do repositório.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Erro no seed da página Sobre:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
