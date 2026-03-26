import { PlatformExperienceEvaluationsClient } from "@/components/platform-experience/PlatformExperienceEvaluationsClient";

export default function ProfessorAvaliacoesExperienciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
      <PlatformExperienceEvaluationsClient
        apiUrl="/api/teacher/platform-experience-feedback"
        exportUrl="/api/teacher/platform-experience-feedback/export"
        exportPdfUrl="/api/teacher/platform-experience-feedback/export-pdf"
        pageTitle="Avaliações dos meus alunos"
        pageDescription="Apenas avaliações enviadas por alunos com matrícula ativa em alguma turma sua. A coluna Turma mostra curso, local, dias e horário das turmas ativas do aluno. “Com.” é abreviação de Comentário."
      />
    </div>
  );
}
