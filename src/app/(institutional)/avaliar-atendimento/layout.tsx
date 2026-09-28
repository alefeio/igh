import type { Metadata } from "next";
import { BRAND, pageTitleLegal } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitleLegal("Avalie o atendimento"),
  description: `Avalie o atendimento do ${BRAND.shortName}. A nota e o canal são os únicos campos obrigatórios.`,
};

export default function AvaliarAtendimentoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
