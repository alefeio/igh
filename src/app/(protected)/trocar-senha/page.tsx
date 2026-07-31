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
  const [keeping, setKeeping] = useState(false);

  const canSubmit =
    currentPassword.length >= 1 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  function redirectAfterSuccess() {
    const from = searchParams.get("from");
    const redirectTo =
      typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
    window.location.href = redirectTo;
  }

  async function keepCurrentPassword() {
    if (keeping || loading) return;
    setKeeping(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepCurrent: true }),
      });
      const json = (await res.json()) as ApiResponse<{ message: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", "error" in json ? json.error.message : "Falha ao manter a senha.");
        return;
      }
      toast.push("success", "Senha atual mantida. Você já pode continuar.");
      redirectAfterSuccess();
    } finally {
      setKeeping(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading || keeping) return;
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
      redirectAfterSuccess();
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
        description="No primeiro acesso você pode definir uma nova senha ou continuar com a senha atual (por exemplo, a data de nascimento)."
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
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Se a senha for a data de nascimento, use 8 dígitos (DDMMAAAA), com zeros — ex.: 01052010.
            </p>
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
          <Button type="submit" disabled={!canSubmit || loading || keeping}>
            {loading ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Manter senha atual"
        description="Se preferir continuar com a senha temporária (data de nascimento ou a senha recebida por e-mail), use o botão abaixo."
        variant="elevated"
      >
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={loading || keeping}
          onClick={() => void keepCurrentPassword()}
        >
          {keeping ? "Confirmando..." : "Manter a senha atual"}
        </Button>
      </SectionCard>
    </div>
  );
}
