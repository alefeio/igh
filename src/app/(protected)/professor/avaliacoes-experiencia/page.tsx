import { PlatformExperienceEvaluationsClient } from "@/components/platform-experience/PlatformExperienceEvaluationsClient";

export default function ProfessorAvaliacoesExperienciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
      <PlatformExperienceEvaluationsClient
        apiUrl="/api/teacher/platform-experience-feedback"
        pageTitle="Avaliações dos meus alunos"
        pageDescription="Apenas avaliações enviadas por alunos com matrícula ativa em alguma turma sua. Médias e lista filtradas automaticamente."
      />
    </div>
  );
}
