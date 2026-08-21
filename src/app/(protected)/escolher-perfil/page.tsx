"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type RolesResponse = {
  canStudent: boolean;
  canTeacher: boolean;
  canAdmin: boolean;
  canAdminManager?: boolean;
  canSiteAdmin?: boolean;
  canPoloCoordinator?: boolean;
  canMaster?: boolean;
  canGeneralAdmin?: boolean;
  canDirector?: boolean;
};

type EnterRole =
  | "STUDENT"
  | "TEACHER"
  | "ADMIN"
  | "ADMIN_MANAGER"
  | "SITE_ADMIN"
  | "MASTER"
  | "GENERAL_ADMIN"
  | "DIRECTOR"
  | "POLO_COORDINATOR";

export default function EscolherPerfilPage() {
  useUser();
  const router = useRouter();
  const toast = useToast();
  const [roles, setRoles] = useState<RolesResponse | null>(null);
  const [submittingRole, setSubmittingRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/roles")
      .then((res) => res.json())
      .then((json: ApiResponse<RolesResponse>) => {
        if (!cancelled && json?.ok && json.data) setRoles(json.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canAdmin = roles?.canAdmin === true;
  const canAdminManager = roles?.canAdminManager === true;
  const canSiteAdmin = roles?.canSiteAdmin === true;
  const canPoloCoordinator = roles?.canPoloCoordinator === true;
  const canStudent = roles?.canStudent === true;
  const canTeacher = roles?.canTeacher === true;
  const canMaster = roles?.canMaster === true;
  const canGeneralAdmin = roles?.canGeneralAdmin === true;
  const canDirector = roles?.canDirector === true;
  const hidesStaffPicker = canMaster || canGeneralAdmin || canDirector;
  const hasAny =
    canAdmin ||
    canAdminManager ||
    canSiteAdmin ||
    canPoloCoordinator ||
    canStudent ||
    canTeacher ||
    canMaster ||
    canGeneralAdmin ||
    canDirector;

  useEffect(() => {
    if (roles !== null && !hasAny) {
      router.replace("/dashboard");
    }
  }, [roles, hasAny, router]);

  if (roles === null) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-0">
        <DashboardHero
          eyebrow="Sessão"
          title="Escolher perfil"
          description="Carregando os perfis disponíveis para sua conta."
        />
        <SectionCard title="Aguarde" variant="elevated">
          <p className="text-sm text-[var(--text-muted)]">Carregando perfis…</p>
        </SectionCard>
      </div>
    );
  }

  if (!hasAny) {
    return null;
  }

  async function enterAs(role: EnterRole) {
    if (submittingRole) return;
    setSubmittingRole(role);
    try {
      const res = await fetch("/api/auth/choose-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ role?: string }> | null;
      if (!res.ok || !json?.ok) {
        const msg =
          json && "error" in json && json.error?.message
            ? json.error.message
            : "Não foi possível definir o perfil. Tente novamente.";
        toast.push("error", msg);
        return;
      }
      /** Recarrega o documento para o layout ler o novo JWT (evita cache do App Router / UserProvider com papel antigo). */
      window.location.assign("/dashboard");
    } finally {
      setSubmittingRole(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-0 sm:py-4">
      <DashboardHero
        eyebrow="Sessão"
        title="Como deseja acessar o sistema?"
        description="Escolha o perfil com o qual deseja entrar nesta sessão."
      />
      <SectionCard title="Perfis disponíveis" variant="elevated">
        <div className="flex flex-col gap-3">
          {canStudent && (
            <Button
              variant="primary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("STUDENT")}
            >
              {submittingRole === "STUDENT" ? "Entrando…" : "Entrar como Aluno"}
            </Button>
          )}
          {canTeacher && (
            <Button
              variant="primary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("TEACHER")}
            >
              {submittingRole === "TEACHER" ? "Entrando…" : "Entrar como Professor"}
            </Button>
          )}
          {canMaster && (
            <Button
              variant="primary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("MASTER")}
            >
              {submittingRole === "MASTER" ? "Entrando…" : "Entrar como Administrador Master"}
            </Button>
          )}
          {canGeneralAdmin && (
            <Button
              variant="primary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("GENERAL_ADMIN")}
            >
              {submittingRole === "GENERAL_ADMIN" ? "Entrando…" : "Entrar como Administrador Geral"}
            </Button>
          )}
          {canDirector && (
            <Button
              variant="primary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("DIRECTOR")}
            >
              {submittingRole === "DIRECTOR" ? "Entrando…" : "Entrar como Diretor"}
            </Button>
          )}
          {canAdmin && !hidesStaffPicker && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("ADMIN")}
            >
              {submittingRole === "ADMIN" ? "Entrando…" : "Entrar como Administrador Pedagógico"}
            </Button>
          )}
          {canAdminManager && !hidesStaffPicker && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("ADMIN_MANAGER")}
            >
              {submittingRole === "ADMIN_MANAGER" ? "Entrando…" : "Entrar como Gerência Administrativa"}
            </Button>
          )}
          {canSiteAdmin && !hidesStaffPicker && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("SITE_ADMIN")}
            >
              {submittingRole === "SITE_ADMIN" ? "Entrando…" : "Entrar como Administrador Site"}
            </Button>
          )}
          {canPoloCoordinator && !hidesStaffPicker && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={!!submittingRole}
              onClick={() => enterAs("POLO_COORDINATOR")}
            >
              {submittingRole === "POLO_COORDINATOR" ? "Entrando…" : "Entrar como Coordenador de Polos"}
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
