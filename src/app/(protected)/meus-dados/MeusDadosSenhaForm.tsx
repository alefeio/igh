"use client";

import { useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

export function MeusDadosSenhaForm() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/me/account/password", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Não foi possível alterar a senha.",
        );
        return;
      }
      toast.push("success", "Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex max-w-lg flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
      <div>
        <label htmlFor="me-pw-current" className="text-sm font-medium text-[var(--text-primary)]">
          Senha atual
        </label>
        <Input
          id="me-pw-current"
          type="password"
          className="mt-1"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label htmlFor="me-pw-new" className="text-sm font-medium text-[var(--text-primary)]">
          Nova senha
        </label>
        <Input
          id="me-pw-new"
          type="password"
          className="mt-1"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">Mínimo de 8 caracteres.</p>
      </div>
      <div>
        <label htmlFor="me-pw-confirm" className="text-sm font-medium text-[var(--text-primary)]">
          Confirmar nova senha
        </label>
        <Input
          id="me-pw-confirm"
          type="password"
          className="mt-1"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <Button type="submit" disabled={saving} variant="secondary">
          {saving ? "Salvando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
