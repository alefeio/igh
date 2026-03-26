import { AttendanceOverviewClient } from "@/components/attendance/AttendanceOverviewClient";

export default function ProfessorFrequenciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
    <AttendanceOverviewClient
      apiUrl="/api/teacher/attendance-overview"
      classGroupsApiUrl="/api/teacher/class-groups"
      exportPdfUrl="/api/teacher/attendance-overview/export-pdf"
      pageTitle="Frequência das minhas turmas"
      pageDescription="Resumo por sessão: presenças / matrículas ativas e ausências com justificativa. Use o filtro por turma ou exporte em PDF."
    />
    </div>
  );
}
