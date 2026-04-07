import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminPlataformaPanels } from "@/components/dashboard/AdminPlataformaPanels";
import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { requireSessionUser } from "@/lib/auth";
import { getAdminPlataformaPagePayload } from "@/lib/dashboard-data";

export const metadata = {
  title: "Visão da plataforma | Admin",
  description: "Engajamento, rankings, avaliações, fórum e acessos.",
};

export default async function AdminPlataformaPage() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN" && user.role !== "MASTER" && user.role !== "COORDINATOR") {
    notFound();
  }

  const payload = await getAdminPlataformaPagePayload(user);
  if (!payload) notFound();

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-4 sm:gap-10">
      <nav aria-label="Navegação" className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--igh-primary)] hover:underline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Dashboard
        </Link>
        <span className="text-[var(--text-muted)]" aria-hidden>
          ·
        </span>
        <span className="text-sm text-[var(--text-muted)]">Administração</span>
      </nav>

      <DashboardHero
        eyebrow="Painel administrativo"
        title="Visão da plataforma"
        description="Indicadores de engajamento, rankings, avaliações, atividade nos fóruns e últimos acessos — carregado só quando você abre esta página."
      />

      <AdminPlataformaPanels payload={payload} />
    </div>
  );
}
