import Link from "next/link";
import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { marketingCampaignVisibilityLabel } from "@/lib/marketing-campaign-active";
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
        description="Ative ou desative campanhas (ex.: Dia das Mães). Desativada, a campanha some da página inicial do site e do dashboard do aluno."
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
                items.map((c) => {
                  const status = marketingCampaignVisibilityLabel({
                    isActive: c.isActive,
                    startsAt: c.startsAt ? new Date(c.startsAt) : null,
                    endsAt: c.endsAt ? new Date(c.endsAt) : null,
                  });
                  return (
                    <tr key={c.id}>
                      <td className="px-3 py-3 font-medium text-[var(--text-primary)]">{c.title}</td>
                      <td className="px-3 py-3 text-[var(--text-muted)]">{c.slug}</td>
                      <td className="px-3 py-3">
                        <Badge tone={status.tone}>{status.text}</Badge>
                      </td>
                      <td className="px-3 py-3">{c.responsesCount}</td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/admin/campanhas/${c.id}`} className="text-[var(--igh-primary)] hover:underline">
                          Gerenciar
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
    </div>
  );
}

