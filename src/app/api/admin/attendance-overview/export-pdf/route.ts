import { getAttendanceOverview } from "@/lib/attendance-session-summary";
import { buildAttendanceOverviewPdf } from "@/lib/attendance-overview-pdf";
import { requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);

  const { searchParams } = new URL(request.url);
  const classGroupId = searchParams.get("classGroupId")?.trim() || undefined;

  const { groups, totals } = await getAttendanceOverview({ classGroupId });
  const pdfBytes = await buildAttendanceOverviewPdf("Frequencia por turma (todas as turmas)", groups, totals);

  const filename = `frequencia-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
