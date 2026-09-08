import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { setHolidayEventAttendance } from "@/lib/holiday-event-attendance";
import { z } from "zod";

const bodySchema = z.object({
  present: z.boolean(),
  notifyParticipant: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ registrationId: string }> },
) {
  const user = await requireRole(["TEACHER"]);
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const { registrationId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const result = await setHolidayEventAttendance({
    registrationId,
    present: parsed.data.present,
    markedBy: { kind: "teacher", teacherId: teacher.id, teacherName: teacher.name },
    notifyParticipant: parsed.data.notifyParticipant ?? false,
  });
  if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);

  const registration = await prisma.holidayEventRegistration.findUnique({
    where: { id: registrationId },
  });

  return jsonOk({ registration, raffleNumber: result.raffleNumber });
}
