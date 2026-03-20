"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

type Course = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  workloadHours: number | null;
  status: "ACTIVE" | "INACTIVE" | "NOT_LISTED";
  createdAt: string;
};

export default function NewCoursePage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length >= 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: "",
          content: "",
          imageUrl: "",
          status: "ACTIVE" as const,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ course: Course }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao criar curso.");
        return;
      }
      toast.push("success", "Curso criado.");
      router.replace(`/courses/${json.data!.course.id}/edit`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="-ml-1 w-fit text-[var(--text-muted)]" onClick={() => router.push("/courses")}>
          ← Voltar aos cursos
        </Button>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Novo curso
        </h1>
      </header>

      <form className="card max-w-xl" onSubmit={handleSubmit}>
        <div className="card-body flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Nome</label>
            <div className="mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do curso" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-3">
            <Button type="button" variant="secondary" onClick={() => router.push("/courses")}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit || saving}>{saving ? "Criando…" : "Criar curso"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
