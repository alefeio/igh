import { z } from "zod";

import { requireStaffWrite } from "@/lib/auth";
import { setHolidayEventAttendance } from "@/lib/holiday-event-attendance";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  present: z.boolean(),
  /** Padrão true no check-in: o participante recebe o número por e-mail. */
  notifyParticipant: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const result = await setHolidayEventAttendance({
    registrationId: id,
    present: parsed.data.present,
    markedBy: { kind: "staff", userId: user.id, userName: user.name },
    notifyParticipant: parsed.data.notifyParticipant ?? true,
  });
  if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);

  const registration = await prisma.holidayEventRegistration.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, whatsapp: true } },
      referrerUser: { select: { id: true, name: true } },
      raffleTicket: { select: { number: true } },
    },
  });

  return jsonOk({
    registration,
    raffleNumber: result.raffleNumber,
    participantName: result.participantName,
  });
}
