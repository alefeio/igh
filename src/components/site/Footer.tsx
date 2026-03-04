import Link from "next/link";
import { FaInstagram, FaFacebookF, FaYoutube, FaLinkedin, FaWhatsapp } from "react-icons/fa";
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

function hasSubItems(items: MenuItemPublic[]): boolean {
  return items.some((i) => i.children && i.children.length > 0);
}

type FooterProps = {
  menuItems?: MenuItemPublic[] | null;
  settings?: SiteSettingsPublic | null;
};

type AddressEntry = { line?: string; city?: string; state?: string; zip?: string };

function normalizeAddresses(value: unknown): AddressEntry[] {
  if (!value || !Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((x) => ({
      line: typeof x.line === "string" ? x.line : "",
      city: typeof x.city === "string" ? x.city : "",
      state: typeof x.state === "string" ? x.state : "",
      zip: typeof x.zip === "string" ? x.zip : "",
    }));
}

function formatAddress(a: AddressEntry): string {
  const parts = [a.line, a.city, a.state, a.zip].filter(Boolean);
  return parts.join(", ");
}

export function Footer({ menuItems, settings }: FooterProps) {
  const showHierarchy = menuItems && menuItems.length > 0 && hasSubItems(menuItems);

  const siteName = settings?.siteName ?? "Instituto Gustavo Hessel";
  const addresses = normalizeAddresses(settings?.addresses);
  const addressLines = addresses.map(formatAddress).filter(Boolean);

  const hasContact =
    !!settings?.contactEmail ||
    !!settings?.contactPhone ||
    !!settings?.contactWhatsapp ||
    addressLines.length > 0 ||
    !!settings?.businessHours;

  const contactLines: string[] = [];
  if (settings?.contactEmail) contactLines.push(settings.contactEmail);
  if (settings?.contactPhone) contactLines.push(settings.contactPhone);
  if (settings?.contactWhatsapp) contactLines.push(`WhatsApp: ${settings.contactWhatsapp}`);

  const whatsappNumber = settings?.contactWhatsapp?.replace(/\D/g, "") || "";
  const whatsappHref = whatsappNumber.length >= 10 ? `https://wa.me/${whatsappNumber.startsWith("55") ? whatsappNumber : "55" + whatsappNumber}` : "#";

  const socials = [
    { name: "Instagram", href: settings?.socialInstagram ?? "#", icon: "instagram" as const },
    { name: "Facebook", href: settings?.socialFacebook ?? "#", icon: "facebook" as const },
    { name: "LinkedIn", href: settings?.socialLinkedin ?? "#", icon: "linkedin" as const },
    { name: "Youtube", href: settings?.socialYoutube ?? "#", icon: "youtube" as const },
    { name: "WhatsApp", href: whatsappHref, icon: "whatsapp" as const },
  ].filter((s) => s.href && s.href !== "#");

  const socialIconMap = {
    instagram: FaInstagram,
    facebook: FaFacebookF,
    youtube: FaYoutube,
    linkedin: FaLinkedin,
    whatsapp: FaWhatsapp,
  } as const;
  const SocialIcon = ({ icon, className }: { icon: keyof typeof socialIconMap; className?: string }) => {
    const c = className ?? "h-5 w-5";
    const IconComponent = socialIconMap[icon];
    return IconComponent ? <IconComponent className={c} aria-hidden /> : null;
  };

  return (
    <footer className="border-t border-[var(--igh-border)] bg-[var(--footer-bg)] text-white">
      <Container className="py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {settings?.logoUrl ? (
              <div className="inline-block rounded-lg bg-white p-2">
                <img src={settings.logoUrl} alt={siteName} className="h-12 w-auto object-contain" />
              </div>
            ) : null}
            <p className={`text-xl font-bold text-white ${settings?.logoUrl ? "mt-2" : ""}`}>{siteName}</p>
            <p className="mt-2 text-sm text-white/80">
              Formação em tecnologia e inclusão digital para transformar vidas.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Links</h3>
            <ul className="mt-4 list-none pl-0">
              {showHierarchy && menuItems ? (
                <>
                  {menuItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="text-sm font-medium text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
                      >
                        {item.label}
                      </Link>
                      {item.children && item.children.length > 0 && (
                        <ul className="ml-3 mt-1 list-none pl-0">
                          {item.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={child.href}
                                className="text-xs text-white/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                  <li>
                    <Link
                      href="/login"
                      className="text-sm font-medium text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
                    >
                      Área do Aluno
                    </Link>
                  </li>
                </>
              ) : (
                (menuItems && menuItems.length > 0
                  ? [...menuItems.flatMap((i) => [i, ...(i.children || [])]), { label: "Área do Aluno", href: "/login", id: "login", order: 999, isExternal: false, children: [] } as MenuItemPublic]
                  : FALLBACK_LINKS.map((link) => ({ ...link, id: link.href, order: 0, isExternal: false, children: [] } as MenuItemPublic))
                ).map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
          {hasContact ? (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Contato</h3>
              <div className="mt-4 space-y-1 text-sm text-white/80">
                {contactLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {addressLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {settings?.businessHours && <p>Horário: {settings.businessHours}</p>}
              </div>
            </div>
          ) : null}
          {socials.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Redes sociais</h3>
            <ul className="mt-4 flex list-none gap-4 pl-0">
              {
                socials.map((s) => (
                  <li key={s.icon}>
                    <a
                      href={s.href}
                      className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded inline-flex items-center justify-center"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                    >
                      <SocialIcon icon={s.icon} className="h-5 w-5" />
                    </a>
                  </li>
                ))
              }
            </ul>
          </div>
          ) : null}
        </div>
        <div className="mt-10 border-t border-white/20 pt-8 text-center text-sm text-white/70">
          <p>© {new Date().getFullYear()} {siteName}. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
