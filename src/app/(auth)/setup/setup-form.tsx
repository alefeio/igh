"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { ApiResponse } from "@/lib/api-types";

export function SetupForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = (await res.json()) as ApiResponse<{ user: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha no setup.");
        return;
      }
      toast.push("success", "MASTER criado com sucesso.");
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div>
        <label className="text-sm font-medium">Nome</label>
        <div className="mt-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">E-mail</label>
        <div className="mt-1">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            type="email"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Senha</label>
        <div className="mt-1">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 8 caracteres"
          />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Criando..." : "Criar MASTER"}
      </Button>
    </form>
  );
}
