import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STUDENT_CONTENT_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";
import { STUDENT_SUSPENSION_BLOCK_MESSAGE } from "@/lib/student-suspension-messages";

type PageProps = {
  params: Promise<{ classGroupId: string; examId: string }>;
};

function AccessDenied({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
      <Link
        href="/minhas-turmas"
        className="mx-auto text-sm font-medium text-[var(--igh-primary)] hover:underline"
      >
        Ir para Minhas turmas
      </Link>
    </div>
  );
}

export default async function AcessoProvaPage({ params }: PageProps) {
  const { classGroupId, examId } = await params;
  const user = await getSessionUserFromCookie();
  if (!user) redirect(`/login?from=${encodeURIComponent(`/acesso-prova/${classGroupId}/${examId}`)}`);
  if (user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return (
      <AccessDenied
        title="Acesso indisponível"
        message="Não encontramos um perfil de aluno associado à sua conta."
      />
    );
  }

  const exam = await prisma.classGroupExam.findFirst({
    where: { id: examId, classGroupId },
    select: { id: true },
  });
  if (!exam) {
    return (
      <AccessDenied
        title="Prova não encontrada"
        message="Esta prova não existe ou não pertence à turma indicada no link."
      />
    );
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, classGroupId },
    select: { id: true, status: true },
  });

  if (!enrollment) {
    return (
      <AccessDenied
        title="Sem acesso à prova"
        message="Você só pode acessar esta prova se estiver matriculado na turma correspondente."
      />
    );
  }

  if (enrollment.status === "SUSPENDED") {
    return <AccessDenied title="Matrícula suspensa" message={STUDENT_SUSPENSION_BLOCK_MESSAGE} />;
  }

  if (!(STUDENT_CONTENT_ENROLLMENT_STATUSES as readonly string[]).includes(enrollment.status)) {
    return (
      <AccessDenied
        title="Sem acesso à prova"
        message="Sua matrícula nesta turma não permite acessar o conteúdo no momento."
      />
    );
  }

  redirect(`/minhas-turmas/${enrollment.id}/prova/${examId}`);
}
