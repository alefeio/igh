import { prisma } from "@/lib/prisma";
import { EMPTY_ATTENDANCE_TOTALS, getAttendanceOverview } from "@/lib/attendance-session-summary";
import { buildAttendanceOverviewPdf } from "@/lib/attendance-overview-pdf";
import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";

export async function GET(request: Request) {
  const user = await requireRole(["TEACHER"]);

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    const empty = await buildAttendanceOverviewPdf(
      "Frequencia por turma (minhas turmas)",
      [],
      EMPTY_ATTENDANCE_TOTALS
    );
    return new Response(Buffer.from(empty), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="frequencia-vazio.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const { searchParams } = new URL(request.url);
  const classGroupIdParam = searchParams.get("classGroupId")?.trim() || undefined;

  if (classGroupIdParam) {
    const owns = await prisma.classGroup.findFirst({
      where: { id: classGroupIdParam, teacherId: teacher.id },
      select: { id: true },
    });
    if (!owns) {
      return jsonErr("FORBIDDEN", "Turma não encontrada ou você não é o professor desta turma.", 403);
    }
  }

  const { groups, totals } = await getAttendanceOverview({
    classGroupId: classGroupIdParam,
    teacherId: teacher.id,
  });
  const pdfBytes = await buildAttendanceOverviewPdf("Frequencia por turma (minhas turmas)", groups, totals);

  const filename = `frequencia-minhas-turmas-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
