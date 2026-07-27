/**
 * Identidade da instituição atendida por este deploy.
 *
 * Vive em variáveis de ambiente, e não em `SiteSettings`, porque é consumida
 * em `export const metadata` estático e em templates de e-mail síncronos —
 * contextos que não podem aguardar uma consulta ao banco. Logo, favicon,
 * cores, contatos e redes sociais seguem vindo do banco, editáveis no admin.
 *
 * Os defaults descrevem o IGH, então a instância existente continua idêntica
 * sem nenhuma variável configurada. Um segundo deploy (ex.: INAC) sobrescreve
 * as `NEXT_PUBLIC_BRAND_*` no painel da Vercel.
 *
 * O prefixo `NEXT_PUBLIC_` é obrigatório porque componentes client
 * (Navbar, Sidebar, widget de atendimento) também exibem esses rótulos.
 */

function fromEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

const shortName = fromEnv(process.env.NEXT_PUBLIC_BRAND_SHORT_NAME, "IGH");
const legalName = fromEnv(process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME, "Instituto Gustavo Hessel");

export const BRAND = {
  /** Sigla para títulos e rótulos curtos. Ex.: "IGH". */
  shortName,
  /** Razão social para rodapés, e-mails e certificados. */
  legalName,
  /** Título da home e fallback de SEO quando o banco não define um. */
  seoTitle: fromEnv(
    process.env.NEXT_PUBLIC_BRAND_SEO_TITLE,
    `${legalName} | Formação profissional em tecnologia`
  ),
  /** Descrição de SEO padrão, usada como fallback do banco. */
  seoDescription: fromEnv(
    process.env.NEXT_PUBLIC_BRAND_SEO_DESCRIPTION,
    `Formação profissional gratuita em programação, dados, UX/UI e mais. Inscreva-se e comece sua trilha no ${shortName}.`
  ),
  /** Nome do fórum interno (Projeto de Integração e Inovação). */
  communityName: `Comunidade ${shortName}`,
  /** Como a equipe da instituição se identifica em respostas e avisos. */
  staffLabel: `Equipe ${shortName}`,
} as const;

/** Título de página no padrão "Seção | Sigla". */
export function pageTitle(section: string): string {
  return `${section} | ${BRAND.shortName}`;
}

/** Título de página no padrão "Seção | Razão social", para páginas de entrada. */
export function pageTitleLegal(section: string): string {
  return `${section} | ${BRAND.legalName}`;
}
