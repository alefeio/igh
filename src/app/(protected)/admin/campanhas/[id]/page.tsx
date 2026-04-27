import Link from "next/link";
import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCampanhaDetalhePage(props: PageProps) {
  await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);
  const { id } = await props.params;

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, description: true, isActive: true, createdAt: true },
  });
  if (!campaign) {
    return (
      <div className="min-w-0 py-6">
        <p className="text-sm text-[var(--text-muted)]">Campanha não encontrada.</p>
        <Link href="/admin/campanhas" className="text-[var(--igh-primary)] hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }

  const responses = await prisma.marketingCampaignResponse.findMany({
    where: { campaignId: id },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      ratingStars: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="min-w-0 py-2 sm:py-4">
      <DashboardHero
        eyebrow="Campanhas"
        title={campaign.title}
        description={campaign.description ?? "Avaliações enviadas pelos alunos."}
        rightSlot={
          <Link
            href="/admin/campanhas"
            className="inline-flex w-full items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium hover:opacity-90 sm:w-auto"
          >
            ← Voltar
          </Link>
        }
      />

      <SectionCard title="Avaliações" description={`Slug: ${campaign.slug} · ${responses.length} respostas`} variant="elevated">
        <TableShell>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-3 py-2">Aluno</th>
                <th className="px-3 py-2">Corações</th>
                <th className="px-3 py-2">Comentário</th>
                <th className="px-3 py-2">Enviado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {responses.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-[var(--text-muted)]" colSpan={4}>
                    Nenhuma avaliação ainda.
                  </td>
                </tr>
              ) : (
                responses.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{r.user.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.user.email}</div>
                    </td>
                    <td className="px-3 py-3">{r.ratingStars}/10</td>
                    <td className="px-3 py-3">{r.comment ?? <span className="text-[var(--text-muted)]">—</span>}</td>
                    <td className="px-3 py-3">{new Date(r.createdAt).toLocaleString("pt-BR")}</td>
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

