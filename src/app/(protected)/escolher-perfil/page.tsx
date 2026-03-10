"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type RolesResponse = { canStudent: boolean; canTeacher: boolean; canAdmin: boolean; canMaster?: boolean };

export default function EscolherPerfilPage() {
  const user = useUser();
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
      <div className="container-page flex justify-center py-12">
        <p className="text-sm text-[var(--text-muted)]">Carregando perfis...</p>
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
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          Como deseja acessar o sistema?
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Escolha o perfil com o qual deseja entrar nesta sessão.
        </p>
        <div className="mt-6 flex flex-col gap-3">
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
      </div>
    </div>
  );
}
