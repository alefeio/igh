"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type RolesResponse = { canStudent: boolean; canTeacher: boolean; canAdmin: boolean; canMaster?: boolean };

export default function EscolherPerfilPage() {
  useUser();
  const router = useRouter();
  const [roles, setRoles] = useState<RolesResponse | null>(null);

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
  const canStudent = roles?.canStudent === true;
  const canTeacher = roles?.canTeacher === true;
  const canMaster = roles?.canMaster === true;
  const hasAny = canAdmin || canStudent || canTeacher || canMaster;

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

  async function enterAs(role: "STUDENT" | "TEACHER" | "ADMIN" | "MASTER") {
    const res = await fetch("/api/auth/choose-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) return;
    router.replace("/dashboard");
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
            <Button variant="primary" className="w-full" onClick={() => enterAs("STUDENT")}>
              Entrar como Aluno
            </Button>
          )}
          {canTeacher && (
            <Button variant="primary" className="w-full" onClick={() => enterAs("TEACHER")}>
              Entrar como Professor
            </Button>
          )}
          {canMaster && (
            <Button variant="primary" className="w-full" onClick={() => enterAs("MASTER")}>
              Entrar como Administrador Master
            </Button>
          )}
          {canAdmin && !canMaster && (
            <Button variant="secondary" className="w-full" onClick={() => enterAs("ADMIN")}>
              Entrar como Admin
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
