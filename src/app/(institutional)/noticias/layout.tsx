import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notícias | Instituto Gustavo Hessel",
  description: "Notícias, cursos, projetos e eventos do IGH.",
};

export default function NoticiasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
