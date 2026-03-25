import { AttendanceOverviewClient } from "@/components/attendance/AttendanceOverviewClient";

export default function ProfessorFrequenciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
    <AttendanceOverviewClient
      apiUrl="/api/teacher/attendance-overview"
      classGroupsApiUrl="/api/teacher/class-groups"
      pageTitle="Frequência das minhas turmas"
      pageDescription="Registros de presença e ausência apenas nas turmas em que você é o professor."
    />
    </div>
  );
}
