"use client";

import { AdminIghCommunityModeration } from "@/components/community/AdminIghCommunityModeration";
import { DashboardHero } from "@/components/dashboard/DashboardUI";

export default function AdminComunidadePage() {
  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow="Comunidade IGH · PII"
        title="Moderação da comunidade"
        description="Exclua tópicos ou comentários inadequados. As publicações entram ao vivo — não há fila de aprovação prévia."
      />
      <div className="mt-6">
        <AdminIghCommunityModeration />
      </div>
    </div>
  );
}
