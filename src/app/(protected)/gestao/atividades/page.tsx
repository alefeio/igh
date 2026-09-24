import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { getSessionUserFromCookie } from "@/lib/auth";
import {
  boardActivitiesAdminHint,
  boardActivitiesDisabledUserMessage,
  getBoardActivitiesGateStatus,
} from "@/lib/board-activities-flag";
import { isBoardEligibleRole } from "@/lib/board-activities";
import GestaoAtividadesClient from "./GestaoAtividadesClient";

export default async function GestaoAtividadesPage() {
  const user = await getSessionUserFromCookie();
  if (!user) redirect("/login");
  if (user.role === "STUDENT" || !isBoardEligibleRole(user.role)) {
    redirect("/dashboard");
  }

  const gate = getBoardActivitiesGateStatus();
  if (!gate.active) {
    if (gate.reason !== "disabled") {
      console.warn("[board-activities]", boardActivitiesAdminHint(gate.reason));
    }
    const isAdmin =
      user.role === "MASTER" || user.role === "GENERAL_ADMIN" || user.role === "ADMIN";
    return (
      <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
        <DashboardHero
          eyebrow="Gestão"
          title="Quadro de Atividades"
          description="Acompanhe o que está planejado, em andamento e concluído."
        />
        <SectionCard title="Indisponível neste ambiente" variant="elevated">
          <p className="text-sm text-[var(--text-secondary)]">
            {boardActivitiesDisabledUserMessage(gate.reason)}
          </p>
          {isAdmin ? (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {boardActivitiesAdminHint(gate.reason)}
            </p>
          ) : null}
        </SectionCard>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--text-muted)]">Carregando Quadro de Atividades...</div>
      }
    >
      <GestaoAtividadesClient />
    </Suspense>
  );
}
