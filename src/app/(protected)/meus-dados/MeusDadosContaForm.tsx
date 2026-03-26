"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

type ProfilePayload = {
  name: string;
  email: string;
  role: string;
  teacher: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
  } | null;
};

function formatPhoneBr(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function MeusDadosContaForm({ roleLabel }: { roleLabel: string }) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/account/profile", { credentials: "include" });
      const json = (await res.json()) as ApiResponse<ProfilePayload>;
      if (!res.ok || !json?.ok || !json.data) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar dados.");
        return;
      }
      setName(json.data.name);
      setEmail(json.data.email);
      const teacher = json.data.teacher;
      setIsTeacher(!!teacher);
      setPhone(teacher?.phone ? formatPhoneBr(teacher.phone) : "");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: { name: string; email: string; phone?: string } = {
        name: name.trim(),
        email: email.trim(),
      };
      if (isTeacher) {
        body.phone = phone.replace(/\D/g, "");
      }
      const res = await fetch("/api/me/account/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Não foi possível salvar.",
        );
        return;
      }
      toast.push("success", "Dados atualizados.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;
  }

  return (
    <form className="flex max-w-lg flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
      <p className="text-sm text-[var(--text-muted)]">
        Perfil: <span className="font-medium text-[var(--text-primary)]">{roleLabel}</span>
      </p>
      <div>
        <label htmlFor="me-name" className="text-sm font-medium text-[var(--text-primary)]">
          Nome completo
        </label>
        <Input
          id="me-name"
          className="mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label htmlFor="me-email" className="text-sm font-medium text-[var(--text-primary)]">
          E-mail (login)
        </label>
        <Input
          id="me-email"
          type="email"
          className="mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      {isTeacher ? (
        <div>
          <label htmlFor="me-phone" className="text-sm font-medium text-[var(--text-primary)]">
            Telefone / WhatsApp
          </label>
          <Input
            id="me-phone"
            className="mt-1"
            value={phone}
            onChange={(e) => setPhone(formatPhoneBr(e.target.value))}
            autoComplete="tel"
            placeholder="(00) 00000-0000"
          />
        </div>
      ) : null}
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
