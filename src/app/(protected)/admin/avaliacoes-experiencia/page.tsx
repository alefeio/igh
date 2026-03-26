import { PlatformExperienceEvaluationsClient } from "@/components/platform-experience/PlatformExperienceEvaluationsClient";

export default function AdminAvaliacoesExperienciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
      <PlatformExperienceEvaluationsClient
        variant="admin"
        apiUrl="/api/admin/platform-experience-feedback"
        exportUrl="/api/admin/platform-experience-feedback/export"
        exportPdfUrl="/api/admin/platform-experience-feedback/export-pdf"
        pageTitle="Avaliações de experiência"
        pageDescription="Notas de 1 a 10 em plataforma, aulas e professor, além de comentários e indicações enviados pelos alunos. A coluna Turma resume curso, local, dias (ex.: ter e qui) e horário das turmas ativas do aluno. “Com.” é abreviação de Comentário. Apenas o usuário Master pode excluir avaliações. Visível para administradores."
      />
    </div>
  );
}
