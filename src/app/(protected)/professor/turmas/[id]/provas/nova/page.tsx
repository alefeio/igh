"use client";

import { useParams } from "next/navigation";
import { ProfessorExamEditor } from "@/components/professor/ProfessorExamEditor";
import { useUser } from "@/components/layout/UserProvider";
import Link from "next/link";

export default function NovaProvaPage() {
  const params = useParams();
  const user = useUser();
  if (user.role === "ADMIN") {
    return (
      <div className="container-page flex flex-col gap-3 py-4">
        <p className="text-sm text-[var(--text-muted)]">Somente o professor da turma pode criar provas.</p>
        <Link href={`/professor/turmas/${params.id as string}/provas`} className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Voltar às provas
        </Link>
      </div>
    );
  }
  return (
    <div className="container-page py-4">
      <ProfessorExamEditor classGroupId={params.id as string} />
    </div>
  );
}
