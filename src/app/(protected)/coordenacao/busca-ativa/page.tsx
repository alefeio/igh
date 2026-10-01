import { CoordenacaoBuscaAtiva } from "@/components/coordenacao/CoordenacaoBuscaAtiva";

export default async function CoordenacaoBuscaAtivaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return <CoordenacaoBuscaAtiva initialQuery={params.q ?? ""} />;
}
