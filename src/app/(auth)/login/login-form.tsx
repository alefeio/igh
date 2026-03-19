"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { ApiResponse } from "@/lib/api-types";

type LoginFormProps = { redirectTo?: string };

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [setupHint, setSetupHint] = useState(false);

  useEffect(() => {
    // Se ainda não tiver MASTER, o /setup estará disponível.
    setSetupHint(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const raw = await res.text();
      let json: ApiResponse<{
        user: { id: string; mustChangePassword?: boolean };
        needsRoleChoice?: boolean;
      }>;
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : { ok: false, error: { code: "EMPTY", message: "Resposta vazia do servidor." } };
      } catch {
        toast.push(
          "error",
          res.ok
            ? "Resposta inválida do servidor. Atualize a página e tente de novo."
            : `Erro no login (${res.status}). Tente novamente.`
        );
        return;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", json.ok === false ? json.error.message : "Falha no login.");
        return;
      }
      if (json.data?.needsRoleChoice) {
        router.replace("/escolher-perfil");
        return;
      }
      if (json.data?.user?.mustChangePassword) {
        router.replace(redirectTo ? `/trocar-senha?from=${encodeURIComponent(redirectTo)}` : "/trocar-senha");
      } else {
        const path = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
        router.replace(path);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div>
        <label className="text-sm font-medium text-[var(--text-primary)]">E-mail ou CPF</label>
        <div className="mt-1">
          <Input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            type="text"
            autoComplete="username"
            placeholder="seu@email.com ou somente números do CPF"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-[var(--text-primary)]">Senha</label>
        <div className="mt-1">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
      <div className="text-center">
        <Link className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]" href="/esqueci-senha">
          Esqueci minha senha
        </Link>
      </div>

      {setupHint ? (
        <div className="pt-2 text-xs text-[var(--text-secondary)]">
          Primeiro acesso? Vá em{" "}
          <Link className="font-medium text-[var(--text-primary)] underline" href="/setup">
            /setup
          </Link>
          .
        </div>
      ) : null}
    </form>
  );
}
