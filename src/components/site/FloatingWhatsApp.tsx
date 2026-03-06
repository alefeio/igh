"use client";

import { FaWhatsapp } from "react-icons/fa";

function buildWhatsAppHref(contactWhatsapp: string | null | undefined): string | null {
  const digits = (contactWhatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

type FloatingWhatsAppProps = {
  contactWhatsapp: string | null | undefined;
  label?: string;
};

export function FloatingWhatsApp({ contactWhatsapp, label = "Fale conosco pelo WhatsApp" }: FloatingWhatsAppProps) {
  const href = buildWhatsAppHref(contactWhatsapp);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#20BD5A] focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 focus:ring-offset-[var(--background)]"
    >
      <FaWhatsapp className="h-7 w-7" aria-hidden />
    </a>
  );
}
