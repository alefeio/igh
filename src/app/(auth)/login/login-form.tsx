"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as ApiResponse<{ user: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha no login.");
        return;
      }
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div>
        <label className="text-sm font-medium">E-mail</label>
        <div className="mt-1">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Senha</label>
        <div className="mt-1">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>

      {setupHint ? (
        <div className="pt-2 text-xs text-zinc-600">
          Primeiro acesso? Vá em{" "}
          <Link className="font-medium text-zinc-900 underline" href="/setup">
            /setup
          </Link>
          .
        </div>
      ) : null}
    </form>
  );
}
