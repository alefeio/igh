"use client";

import Link from "next/link";

import { IghCommunityHub } from "@/components/community/IghCommunityHub";
import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";

export default function ComunidadePage() {
  const user = useUser();
  const isStaff = ["MASTER", "ADMIN", "COORDINATOR"].includes(user.role);
  const isTeacher = user.role === "TEACHER";
  const canCreateTopics = user.role === "STUDENT";

  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow="PII · Projeto de Integração e Inovação"
        title="Comunidade IGH"
        description={
          <>
            Espaço para <strong>todos os cadastrados no portal</strong> compartilharem ideias, formarem equipes e
            debaterem o projeto integrador — mesmo sem matrícula em curso.{" "}
            {user.role === "STUDENT" ? (
              <>
                O fórum por aula continua em{" "}
                <Link href="/minhas-turmas/forum" className="font-medium text-[var(--igh-primary)] hover:underline">
                  Fórum dos cursos
                </Link>
                ; aqui o foco é a inovação entre disciplinas.
              </>
            ) : (
              <>Abra um tópico e use &quot;Participar da conversa&quot; para orientar os alunos.</>
            )}
          </>
        }
      />

      {isStaff && (
        <p className="mt-4 rounded-lg border border-[var(--card-border)] bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Moderação:{" "}
          <Link href="/admin/comunidade" className="font-semibold text-[var(--igh-primary)] hover:underline">
            gerenciar publicações
          </Link>
          . Você pode excluir tópicos ou comentários inadequados a qualquer momento.
        </p>
      )}

      {isTeacher && (
        <p className="mt-4 rounded-lg border border-[var(--card-border)] bg-sky-50/80 px-3 py-2 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
          Professores podem participar das conversas em cada tópico pelo botão{" "}
          <strong>Participar da conversa</strong>.
        </p>
      )}

      <div className="mt-6">
        <IghCommunityHub canCreateTopics={canCreateTopics} />
      </div>
    </div>
  );
}
