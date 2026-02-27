"use client";

import Link from "next/link";
import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function EsqueciSenhaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSent(false);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.push("error", json?.error?.message ?? "Falha ao enviar.");
        return;
      }
      setSent(true);
      toast.push("success", "Se o e-mail estiver cadastrado, você receberá o link.");
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
          <div className="text-lg font-semibold">Esqueci minha senha</div>
          <div className="mt-1 text-sm text-zinc-600">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </div>
        </div>
        <div className="card-body">
          {sent ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Verifique sua caixa de entrada e o spam. O link expira em 24 horas.
              </p>
              <Link className="text-sm font-medium text-blue-600 underline" href="/login">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={submit}>
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <div className="mt-1">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    placeholder="seu@email.com"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
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
