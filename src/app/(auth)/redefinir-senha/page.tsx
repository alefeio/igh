"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";

function RedefinirSenhaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const token = searchParams.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      toast.push("error", "Link inválido. Solicite uma nova redefinição de senha.");
    }
  }, [token, toast]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      toast.push("error", "A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.push("error", "As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.push("error", json?.error?.message ?? "Falha ao redefinir senha.");
        return;
      }
      toast.push("success", "Senha alterada. Faça login.");
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="mb-4 flex justify-center sm:mb-6">
        <img src="/images/logo.png" alt="Logo" className="h-16 w-auto object-contain sm:h-20" />
      </div>
      <div className="card w-full">
        <div className="card-header">
          <div className="text-lg font-semibold">Nova senha</div>
          <div className="mt-1 text-sm text-zinc-600">
            Defina uma nova senha para acessar o sistema.
          </div>
        </div>
        <div className="card-body">
          {!token ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600">Use o link que enviamos por e-mail ou solicite um novo.</p>
              <Link className="text-sm font-medium text-blue-600 underline" href="/esqueci-senha">
                Solicitar novo link
              </Link>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={submit}>
              <div>
                <label className="text-sm font-medium">Nova senha</label>
                <div className="mt-1">
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Confirmar senha</label>
                <div className="mt-1">
                  <PasswordInput
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
              <Link className="text-center text-sm text-zinc-600 underline" href="/login">
                Voltar ao login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-zinc-600">Carregando...</div>}>
      <RedefinirSenhaContent />
    </Suspense>
  );
}
