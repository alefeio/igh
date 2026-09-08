import { requireStaffRead } from "@/lib/auth";
import { buildHolidayEventRegistrationsXlsx } from "@/lib/holiday-event-report";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffRead();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const occurrenceDate = searchParams.get("occurrenceDate")?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    return jsonErr("VALIDATION_ERROR", "Informe a data da ocorrência.", 400);
  }

  const holiday = await prisma.holiday.findUnique({ where: { id }, select: { id: true } });
  if (!holiday) return jsonErr("NOT_FOUND", "Evento não encontrado.", 404);

  const { buffer, fileName } = await buildHolidayEventRegistrationsXlsx({
    holidayId: id,
    occurrenceDate,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
