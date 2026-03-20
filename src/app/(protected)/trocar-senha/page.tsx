"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { ApiResponse } from "@/lib/api-types";

export default function TrocarSenhaPage() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit =
    currentPassword.length >= 1 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ message: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", "error" in json ? json.error.message : "Falha ao alterar senha.");
        return;
      }
      toast.push("success", "Senha alterada com sucesso.");
      const from = searchParams.get("from");
      const redirectTo =
        typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
      window.location.href = redirectTo;
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Conta"
        title="Trocar senha"
        description="Por segurança, altere sua senha temporária antes de continuar."
      />
      <SectionCard title="Definir nova senha" variant="elevated">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Senha atual</label>
            <div className="mt-1">
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Nova senha</label>
            <div className="mt-1">
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Mínimo de 8 caracteres.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Confirmar nova senha</label>
            <div className="mt-1">
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600">As senhas não coincidem.</p>
            )}
          </div>
          <Button type="submit" disabled={!canSubmit || loading}>
            {loading ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
