import { AttendanceOverviewClient } from "@/components/attendance/AttendanceOverviewClient";

export default function AdminFrequenciaPage() {
  return (
    <div className="min-w-0 py-2 sm:py-4">
    <AttendanceOverviewClient
      apiUrl="/api/admin/attendance-overview"
      classGroupsApiUrl="/api/class-groups"
      exportPdfUrl="/api/admin/attendance-overview/export-pdf"
      pageTitle="Frequência (todas as turmas)"
      pageDescription="Resumo por dia e turma: presenças em relação às matrículas ativas e quantidade de ausências com justificativa. Exporte em PDF quando precisar."
    />
    </div>
  );
}
