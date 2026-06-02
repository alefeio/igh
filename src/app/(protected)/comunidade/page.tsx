"use client";

import Link from "next/link";

import { IghCommunityHub } from "@/components/community/IghCommunityHub";
import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";

export default function ComunidadePage() {
  const user = useUser();
  const isStaff = ["MASTER", "ADMIN", "COORDINATOR"].includes(user.role);
  const readOnly = user.role !== "STUDENT";

  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow="PII · Projeto de Integração e Inovação"
        title="Comunidade IGH"
        description={
          <>
            Espaço para alunos de <strong>todos os cursos</strong> compartilharem ideias, formarem equipes e debaterem o
            projeto integrador.             {user.role === "STUDENT" ? (
              <>
                O fórum por aula continua em{" "}
                <Link href="/minhas-turmas/forum" className="font-medium text-[var(--igh-primary)] hover:underline">
                  Fórum dos cursos
                </Link>
                ; aqui o foco é a inovação entre disciplinas.
              </>
            ) : (
              <>Aqui o foco é a inovação e o projeto integrador entre disciplinas.</>
            )}
          </>
        }
      />

      {isStaff && (
        <p className="mt-4 rounded-lg border border-[var(--card-border)] bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Moderação:{" "}
          <Link href="/admin/comunidade" className="font-semibold text-[var(--igh-primary)] hover:underline">
            fila de aprovação
          </Link>
          . Publicações dos alunos passam por revisão antes de ficarem visíveis.
        </p>
      )}

      <div className="mt-6">
        <IghCommunityHub readOnly={readOnly} />
      </div>
    </div>
  );
}
