import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { generateHolidayEventCertificatePdfBytes, uploadCertificatePdfToApimages } from "@/lib/holiday-event-certificate";
import { z } from "zod";

const bodySchema = z.object({
  present: z.boolean(),
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

  const reg = await prisma.holidayEventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      holiday: {
        select: {
          id: true,
          name: true,
          allowsRegistration: true,
          isActive: true,
          responsibleTeacherId: true,
          eventStartTime: true,
          eventEndTime: true,
          recurring: true,
          subtitle: true,
        },
      },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!reg) return jsonErr("NOT_FOUND", "Inscrição não encontrada.", 404);
  if (!reg.holiday?.isActive || !reg.holiday?.allowsRegistration) {
    return jsonErr("NOT_FOUND", "Evento não encontrado.", 404);
  }
  if (reg.holiday.responsibleTeacherId !== teacher.id) {
    return jsonErr("FORBIDDEN", "Você não é o professor responsável por este evento.", 403);
  }

  const updated = await prisma.holidayEventRegistration.update({
    where: { id: registrationId },
    data: {
      present: parsed.data.present,
      attendanceMarkedAt: new Date(),
      attendanceMarkedByTeacherId: teacher.id,
      ...(parsed.data.present
        ? {}
        : {
            certificateUrl: null,
            certificatePublicId: null,
            certificateFileName: null,
          }),
    },
  });

  if (parsed.data.present && !updated.certificateUrl) {
    try {
      const pdfBytes = await generateHolidayEventCertificatePdfBytes({
        participantName: (reg.user?.name ?? reg.guestName ?? "Participante").trim(),
        eventName: reg.holiday.name?.trim() || "Evento IGH",
        occurrenceDate: reg.occurrenceDate,
        eventStartTime: reg.holiday.eventStartTime,
        eventEndTime: reg.holiday.eventEndTime,
        responsibleTeacherName: teacher.name,
      });
      const safeDate = reg.occurrenceDate.replaceAll("-", "");
      const participantSlug = (reg.user?.name ?? reg.guestName ?? "participante")
        .trim()
        .slice(0, 32)
        .replaceAll(" ", "-");
      const fileName = `certificado-evento-${safeDate}-${participantSlug}.pdf`;
      const up = await uploadCertificatePdfToApimages({ pdfBytes, fileName });
      const finalReg = await prisma.holidayEventRegistration.update({
        where: { id: updated.id },
        data: {
          certificateUrl: up.url,
          certificatePublicId: up.publicId,
          certificateFileName: up.fileName,
        },
      });
      return jsonOk({ registration: finalReg });
    } catch {
      // Se o upload falhar, mantém presença marcada (certificado pode ser gerado depois).
      return jsonOk({ registration: updated });
    }
  }

  return jsonOk({ registration: updated });
}

