import { AttendanceOverviewClient } from "@/components/attendance/AttendanceOverviewClient";

export default function AdminFrequenciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
    <AttendanceOverviewClient
      apiUrl="/api/admin/attendance-overview"
      classGroupsApiUrl="/api/class-groups"
      pageTitle="Frequência (todas as turmas)"
      pageDescription="Consulta de presenças e ausências registradas pelo professor em cada sessão. Use o filtro por turma para focar em um grupo."
    />
    </div>
  );
}
