"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { ApiResponse } from "@/lib/api-types";

type CadastroFormProps = { redirectTo?: string };

export function CadastroForm({ redirectTo }: CadastroFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const raw = await res.text();
      let json: ApiResponse<{ redirectTo?: string }>;
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : { ok: false, error: { code: "EMPTY", message: "Resposta vazia do servidor." } };
      } catch {
        toast.push("error", "Resposta inválida do servidor. Atualize a página e tente novamente.");
        return;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", json.ok === false ? json.error.message : "Não foi possível concluir seu cadastro.");
        return;
      }
      const nextPath =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : (json.data?.redirectTo ?? "/dashboard");
      router.replace(nextPath);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div>
        <label className="text-sm font-medium text-[var(--text-primary)]">Nome</label>
        <div className="mt-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name" placeholder="Seu nome completo" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-[var(--text-primary)]">E-mail</label>
        <div className="mt-1">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="seu@email.com" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-[var(--text-primary)]">Senha</label>
        <div className="mt-1">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Criando conta..." : "Criar conta e participar"}
      </Button>

      <p className="text-center text-xs text-[var(--text-muted)]">
        Já tem conta?{" "}
        <Link href={redirectTo ? `/login?from=${encodeURIComponent(redirectTo)}` : "/login"} className="underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
