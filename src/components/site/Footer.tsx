import Link from "next/link";
import { Container } from "./Container";
import type { MenuItemPublic, SiteSettingsPublic } from "@/lib/site-types";

const FALLBACK_LINKS = [
  { label: "Início", href: "/" },
  { label: "Sobre", href: "/sobre" },
  { label: "Formações", href: "/formacoes" },
  { label: "Projetos", href: "/projetos" },
  { label: "Notícias", href: "/noticias" },
  { label: "Transparência", href: "/transparencia" },
  { label: "Contato", href: "/contato" },
  { label: "Área do Aluno", href: "/login" },
];

function flattenMenu(items: MenuItemPublic[]): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  for (const i of items) {
    out.push({ label: i.label, href: i.href });
    for (const c of i.children || []) out.push({ label: c.label, href: c.href });
  }
  return out;
}

type FooterProps = {
  menuItems?: MenuItemPublic[] | null;
  settings?: SiteSettingsPublic | null;
};

export function Footer({ menuItems, settings }: FooterProps) {
  const footerLinks =
    menuItems && menuItems.length > 0
      ? [...flattenMenu(menuItems), { label: "Área do Aluno", href: "/login" }]
      : FALLBACK_LINKS;

  const contactEmail = settings?.contactEmail ?? "contato@igh.org.br";
  const contactPhone = settings?.contactPhone ?? "(11) 1234-5678";
  const siteName = settings?.siteName ?? "Instituto Gustavo Hessel";

  const socials = [
    { name: "Instagram", href: settings?.socialInstagram ?? "#", icon: "instagram" },
    { name: "Facebook", href: settings?.socialFacebook ?? "#", icon: "facebook" },
    { name: "LinkedIn", href: settings?.socialLinkedin ?? "#", icon: "linkedin" },
    { name: "Youtube", href: settings?.socialYoutube ?? "#", icon: "youtube" },
  ].filter((s) => s.href && s.href !== "#");

  return (
    <footer className="border-t border-[var(--igh-border)] bg-[var(--igh-secondary)] text-white">
      <Container className="py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xl font-bold text-white">{siteName}</p>
            <p className="mt-2 text-sm text-white/80">
              Formação em tecnologia e inclusão digital para transformar vidas.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Links</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Contato</h3>
            <p className="mt-4 text-sm text-white/80">
              {contactEmail}
              {contactPhone && (
                <>
                  <br />
                  {contactPhone}
                </>
              )}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Redes sociais</h3>
            <ul className="mt-4 flex gap-4">
              {socials.length > 0 ? (
                socials.map((s) => (
                  <li key={s.icon}>
                    <a
                      href={s.href}
                      className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                    >
                      <span className="text-sm font-medium">{s.name}</span>
                    </a>
                  </li>
                ))
              ) : (
                <>
                  <li><span className="text-sm text-white/70">Instagram</span></li>
                  <li><span className="text-sm text-white/70">Facebook</span></li>
                  <li><span className="text-sm text-white/70">LinkedIn</span></li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-white/20 pt-8 text-center text-sm text-white/70">
          <p>© {new Date().getFullYear()} {siteName}. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
