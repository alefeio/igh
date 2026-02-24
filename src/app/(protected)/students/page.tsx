import { requireRole } from "@/lib/auth";

export default async function StudentsPlaceholderPage() {
  await requireRole(["MASTER", "ADMIN"]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="text-lg font-semibold">Alunos (em breve)</div>
        <div className="mt-1 text-sm text-zinc-600">
          O módulo de Alunos não faz parte do MVP 1, mas a estrutura já está preparada para evoluir.
        </div>
      </div>
      <div className="card-body">
        <ul className="list-disc pl-5 text-sm text-zinc-700">
          <li>`Student` (entidade principal)</li>
          <li>`Enrollment` (matrícula / vínculo com turma)</li>
          <li>`ChangeRequest` (solicitações de edição com aprovação do MASTER)</li>
        </ul>
      </div>
    </div>
  );
}
