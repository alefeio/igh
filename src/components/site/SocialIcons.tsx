import { FaInstagram, FaFacebookF, FaYoutube, FaLinkedin, FaWhatsapp } from "react-icons/fa";

type SocialItem = { name: string; href: string; icon: "instagram" | "facebook" | "youtube" | "linkedin" | "whatsapp" };

const iconMap = {
  instagram: FaInstagram,
  facebook: FaFacebookF,
  youtube: FaYoutube,
  linkedin: FaLinkedin,
  whatsapp: FaWhatsapp,
} as const;

function Icon({ icon, className }: { icon: SocialItem["icon"]; className?: string }) {
  const c = className ?? "h-5 w-5";
  const Component = iconMap[icon];
  return Component ? <Component className={c} aria-hidden /> : null;
}

export function SocialIcons({
  items,
  className = "",
  iconClassName = "h-5 w-5",
}: {
  items: SocialItem[];
  className?: string;
  iconClassName?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>
      {items.map((s) => (
        <a
          key={s.icon}
          href={s.href}
          className="text-[var(--igh-muted)] hover:text-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] rounded inline-flex"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.name}
        >
          <Icon icon={s.icon} className={iconClassName} />
        </a>
      ))}
    </div>
  );
}
