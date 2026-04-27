import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { isMarketingCampaignActiveInWindow } from "@/lib/marketing-campaign-active";

export async function GET() {
  const user = await requireRole("STUDENT");

  const campaigns = await prisma.marketingCampaign.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
    },
  });

  const active = campaigns.find((c) => isMarketingCampaignActiveInWindow(c)) ?? null;
  if (!active) return jsonOk({ campaign: null });

  // Conteúdo específico (Dia das Mães): garante copy correta mesmo se o DB ainda tiver texto antigo.
  const mothersCopy =
    "Conte-nos um pouco sobre a sua mãe e como ela contribuiu para que você pudesse estar aqui hoje, buscando uma qualificação profissional no IGH.";
  const description =
    active.slug === "dia-das-maes-2026" ? mothersCopy : (active.description ?? null);

  const hasResponded =
    (await prisma.marketingCampaignResponse.count({
      where: { campaignId: active.id, userId: user.id },
    })) > 0;

  return jsonOk({
    campaign: {
      ...active,
      description,
      startsAt: active.startsAt ? active.startsAt.toISOString() : null,
      endsAt: active.endsAt ? active.endsAt.toISOString() : null,
    },
    hasResponded,
  });
}

