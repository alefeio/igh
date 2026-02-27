import Link from "next/link";
import { Container } from "./Container";

const footerLinks = [
  { label: "Início", href: "/" },
  { label: "Sobre", href: "/sobre" },
  { label: "Formações", href: "/formacoes" },
  { label: "Projetos", href: "/projetos" },
  { label: "Notícias", href: "/noticias" },
  { label: "Transparência", href: "/transparencia" },
  { label: "Contato", href: "/contato" },
  { label: "Área do Aluno", href: "/login" },
];

const socialPlaceholders = [
  { name: "Facebook", href: "#", icon: "facebook" },
  { name: "Instagram", href: "#", icon: "instagram" },
  { name: "LinkedIn", href: "#", icon: "linkedin" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--igh-border)] bg-[var(--igh-secondary)] text-white">
      <Container className="py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xl font-bold text-white">Instituto Gustavo Hessel</p>
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
              contato@igh.org.br
              <br />
              (11) 1234-5678
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Redes sociais</h3>
            <ul className="mt-4 flex gap-4">
              {socialPlaceholders.map((s) => (
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
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-white/20 pt-8 text-center text-sm text-white/70">
          <p>© {new Date().getFullYear()} Instituto Gustavo Hessel. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
