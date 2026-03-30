import "server-only";

import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

/**
 * Na última semana antes do fim da turma, lembra documentos obrigatórios em falta (RG/CNH e comprovante).
 * Idempotente por matrícula (`dedupeKey`).
 */
export async function ensurePendingDocumentRemindersForStudent(
  studentId: string,
  userId: string
): Promise<void> {
  const attachments = await prisma.studentAttachment.findMany({
    where: { studentId, deletedAt: null },
    select: { type: true },
  });
  const hasId = attachments.some((a) => a.type === "ID_DOCUMENT");
  const hasAddr = attachments.some((a) => a.type === "ADDRESS_PROOF");
  const missing: string[] = [];
  if (!hasId) missing.push("documento de identidade (RG/CNH)");
  if (!hasAddr) missing.push("comprovante de endereço");
  if (missing.length === 0) return;

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    include: {
      classGroup: { select: { endDate: true, course: { select: { name: true } } } },
    },
  });

  const today = getBrazilTodayDateOnly();

  for (const e of enrollments) {
    const end = e.classGroup.endDate;
    if (!end) continue;
    const weekBefore = new Date(end);
    weekBefore.setUTCDate(weekBefore.getUTCDate() - 7);
    if (today < weekBefore || today > end) continue;

    await createUserNotificationIfNew({
      userId,
      kind: "PENDING_DOCUMENT_REMINDER",
      title: "Documentos pendentes",
      body: `Envie ${missing.join(" e ")} — prazo da turma "${e.classGroup.course.name}" se aproxima.`,
      linkUrl: "/meus-dados",
      dedupeKey: `doc_reminder:${e.id}`,
    });
  }
}
