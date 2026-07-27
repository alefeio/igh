"use client";

import { AdminIghCommunityModeration } from "@/components/community/AdminIghCommunityModeration";
import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { BRAND } from "@/lib/brand";

export default function AdminComunidadePage() {
  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow={`${BRAND.communityName} · PII`}
        title="Moderação da comunidade"
        description="Exclua tópicos ou comentários inadequados. As publicações entram ao vivo — não há fila de aprovação prévia."
      />
      <div className="mt-6">
        <AdminIghCommunityModeration />
      </div>
    </div>
  );
}
