import Link from "next/link";
import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CampaignRow = {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  responsesCount: number;
};

export default async function AdminCampanhasPage() {
  await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);

  const itemsRaw = (await prisma.marketingCampaign.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { responses: true } },
    },
  })) as Array<{
    id: string;
    slug: string;
    title: string;
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    _count: { responses: number };
  }>;

  const items: CampaignRow[] = itemsRaw.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    isActive: c.isActive,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    responsesCount: c._count.responses,
  }));

  return (
    <div className="min-w-0 py-2 sm:py-4">
      <DashboardHero
        eyebrow="Administração"
        title="Campanhas (avaliações)"
        description="Organize campanhas de marketing/pesquisa e consulte as avaliações enviadas pelos alunos."
      />

      <SectionCard title="Campanhas" variant="elevated">
        <TableShell>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Respostas</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {items.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-[var(--text-muted)]" colSpan={5}>
                    Nenhuma campanha cadastrada.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-3 font-medium text-[var(--text-primary)]">{c.title}</td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">{c.slug}</td>
                    <td className="px-3 py-3">{c.isActive ? "Ativa" : "Inativa"}</td>
                    <td className="px-3 py-3">{c.responsesCount}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/admin/campanhas/${c.id}`} className="text-[var(--igh-primary)] hover:underline">
                        Ver avaliações
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
    </div>
  );
}

