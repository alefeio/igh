import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contato | Instituto Gustavo Hessel",
  description: "Entre em contato com o IGH ou inscreva-se nas formações.",
};

export default function ContatoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
