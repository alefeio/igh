"use client";

import { AdminIghCommunityModeration } from "@/components/community/AdminIghCommunityModeration";
import { DashboardHero } from "@/components/dashboard/DashboardUI";

export default function AdminComunidadePage() {
  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow="Comunidade IGH · PII"
        title="Moderação da comunidade"
        description="Revise publicações dos alunos antes de liberar para toda a comunidade. Você pode editar o texto para adequar tom e remover dados sensíveis."
      />
      <div className="mt-6">
        <AdminIghCommunityModeration />
      </div>
    </div>
  );
}
