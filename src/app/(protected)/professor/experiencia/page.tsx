import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { TeacherClassEvaluationsPanel } from "@/components/professor/TeacherClassEvaluationsPanel";
import { TeacherEvaluationRankingSection } from "@/components/professor/TeacherEvaluationRankingSection";

export default function ProfessorExperienciaPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6 py-2 sm:py-4">
      <DashboardHero
        eyebrow="Professor"
        title="Experiência do aluno"
        description="Mensagens e notas enviadas para você na página da turma. Avaliações anônimas ficam só com a coordenação."
      />
      <TeacherEvaluationRankingSection />
      <TeacherClassEvaluationsPanel apiUrl="/api/teacher/class-evaluations" showTeacherName={false} />
    </div>
  );
}
