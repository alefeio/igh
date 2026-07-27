import type { Metadata } from "next";
import { BRAND, pageTitleLegal } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitleLegal("Contato"),
  description: `Entre em contato com o ${BRAND.shortName} ou inscreva-se nas formações.`,
};

export default function ContatoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
