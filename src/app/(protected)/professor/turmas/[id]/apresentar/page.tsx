"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";
import { ChevronRight } from "lucide-react";

type ModuleRow = {
  id: string;
  title: string;
  order: number;
  lessons: { id: string; title: string; order: number }[];
};

export default function ProfessorApresentarIndexPage() {
  const params = useParams();
  const classGroupId = params.id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [modules, setModules] = useState<ModuleRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/presentation`);
      const json = (await res.json()) as ApiResponse<{
        classGroup: { id: string; courseName: string };
        modules: ModuleRow[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível carregar o curso.");
        setModules([]);
        return;
      }
      setCourseName(json.data.classGroup.courseName);
      setModules(json.data.modules);
    } finally {
      setLoading(false);
    }
  }, [classGroupId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Professor"
        title="Modo apresentação"
        description={`Escolha uma aula de “${courseName || "…"}” para exibir em sala (slides, vídeo e material).`}
        rightSlot={
          <Link
            href={`/professor/turmas/${classGroupId}`}
            className="inline-flex w-full items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90 sm:w-auto"
          >
            ← Voltar à turma
          </Link>
        }
      />

      <SectionCard
        title="Aulas do curso"
        description="Abre em tela cheia amigável para projetor ou compartilhamento de tela."
        variant="elevated"
      >
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : modules.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum módulo encontrado.</p>
        ) : (
          <div className="space-y-6">
            {modules.map((mod) => (
              <div key={mod.id}>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{mod.title}</h3>
                <ul className="mt-2 divide-y divide-[var(--card-border)] rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/30">
                  {mod.lessons.map((les) => (
                    <li key={les.id}>
                      <Link
                        href={`/professor/turmas/${classGroupId}/apresentar/${les.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--text-primary)] transition hover:bg-[var(--igh-surface)]"
                      >
                        <span>{les.title}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
