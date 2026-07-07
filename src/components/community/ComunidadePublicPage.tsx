"use client";

import Link from "next/link";

import { IghCommunityHub } from "@/components/community/IghCommunityHub";
import { IghCommunityTopicDetail } from "@/components/community/IghCommunityTopicDetail";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site/Button";
import type { CommunityViewer } from "@/lib/igh-community-types";

function GuestPublishCta() {
  return (
    <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-4 text-sm text-[var(--igh-muted)]">
      <p>
        Qualquer pessoa pode <strong className="text-[var(--igh-secondary)]">ler</strong> as publicações. Para publicar
        ideias ou responder, entre com sua conta de aluno, professor ou equipe IGH.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button as="link" href="/login?from=%2Fcomunidade" size="sm">
          Entrar
        </Button>
        <Button as="link" href="/cadastro?from=%2Fcomunidade" variant="secondary" size="sm">
          Criar conta gratuita
        </Button>
      </div>
    </div>
  );
}

export function ComunidadePublicPage({ sessionUser }: { sessionUser: CommunityViewer | null }) {
  const isStaff = sessionUser?.role ? ["MASTER", "ADMIN", "COORDINATOR"].includes(sessionUser.role) : false;
  const isTeacher = sessionUser?.role === "TEACHER";
  const isStudent = sessionUser?.role === "STUDENT";

  return (
    <ToastProvider>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--igh-primary)]">
          PII · Projeto de Integração e Inovação
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--igh-secondary)] sm:text-4xl">Comunidade IGH</h1>
        <p className="mt-3 max-w-3xl text-base text-[var(--igh-muted)]">
          Espaço aberto para acompanhar ideias, equipes e debates do projeto integrador entre cursos.{" "}
          <strong className="text-[var(--igh-secondary)]">A leitura é pública</strong>; publicar e responder exige
          cadastro no portal.
          {isStudent ? (
            <>
              {" "}
              O fórum por aula continua em{" "}
              <Link href="/minhas-turmas/forum" className="font-medium text-[var(--igh-primary)] hover:underline">
                Fórum dos cursos
              </Link>
              .
            </>
          ) : null}
          {isTeacher ? <> Professores podem orientar alunos pelo botão &quot;Participar da conversa&quot; em cada tópico.</> : null}
        </p>

        {isStaff ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Moderação:{" "}
            <Link href="/admin/comunidade" className="font-semibold text-[var(--igh-primary)] hover:underline">
              gerenciar publicações
            </Link>
            .
          </p>
        ) : null}

        {!sessionUser ? (
          <div className="mt-6">
            <GuestPublishCta />
          </div>
        ) : null}

        <div className="mt-8">
          <IghCommunityHub sessionUser={sessionUser} />
        </div>
      </div>
    </ToastProvider>
  );
}

export function ComunidadeTopicPublicPage({
  topicId,
  sessionUser,
}: {
  topicId: string;
  sessionUser: CommunityViewer | null;
}) {
  return (
    <ToastProvider>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <IghCommunityTopicDetail topicId={topicId} sessionUser={sessionUser} />
      </div>
    </ToastProvider>
  );
}
