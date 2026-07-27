import type { Metadata } from "next";
import { BRAND, pageTitleLegal } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitleLegal("Notícias"),
  description: `Notícias, cursos, projetos e eventos do ${BRAND.shortName}.`,
};

export default function NoticiasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
