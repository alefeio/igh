import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { getCurrentCycleId } from "@/lib/current-cycle";
import { jsonErr, jsonOk } from "@/lib/http";
import { resolveNextCycleInterestEnrollmentMap } from "@/lib/next-cycle-interest-admin";
import { prisma } from "@/lib/prisma";

/**
 * Lista pré-inscrições vinculadas ao ciclo atual (último cadastrado).
 * Ao criar/avançar o ciclo, os nomes do ciclo anterior deixam de aparecer.
 */
export async function GET() {
  await requireRole(["ADMIN", "MASTER", "SITE_ADMIN"]);

  const currentCycleId = await getCurrentCycleId();
  if (!currentCycleId) {
    return jsonOk({ items: [], cycleId: null });
  }

  const items = await prisma.nextCycleInterest.findMany({
    where: { cycleId: currentCycleId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { contacts: true } },
      contacts: {
        orderBy: { contactedAt: "desc" },
        select: {
          id: true,
          contactedAt: true,
          gotResponse: true,
          notes: true,
          contactedByUser: { select: { id: true, name: true } },
        },
      },
    },
  });

  const allCourseIds = [...new Set(items.flatMap((i) => i.courseIds))];
  const courses =
    allCourseIds.length === 0
      ? []
      : await prisma.course.findMany({
          where: { id: { in: allCourseIds } },
          select: { id: true, name: true },
        });
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  const enrollmentMap = await resolveNextCycleInterestEnrollmentMap(
    items.map((i) => ({ id: i.id, email: i.email, phone: i.phone })),
  );

  return jsonOk({
    cycleId: currentCycleId,
    items: items.map((item) => {
      const courseNames = item.courseIds
        .map((id) => courseNameById.get(id) ?? `Curso removido (${id.slice(0, 8)})`)
        .filter(Boolean);
      if (item.customCourseName?.trim()) {
        courseNames.push(`Outro: ${item.customCourseName.trim()}`);
      }
      const enrollment = enrollmentMap.get(item.id) ?? null;
      const lastContact = item.contacts[0] ?? null;
      return {
        id: item.id,
        name: item.name,
        phone: item.phone,
        email: item.email,
        courseIds: item.courseIds,
        courseNames,
        customCourseName: item.customCourseName,
        source: item.source,
        createdAt: item.createdAt.toISOString(),
        contactsCount: item._count.contacts,
        lastContact: lastContact
          ? {
              id: lastContact.id,
              contactedAt: lastContact.contactedAt.toISOString(),
              gotResponse: lastContact.gotResponse,
              notes: lastContact.notes,
              contactedByName: lastContact.contactedByUser.name,
              contactedByUserId: lastContact.contactedByUser.id,
            }
          : null,
        contacts: item.contacts.map((c) => ({
          id: c.id,
          contactedAt: c.contactedAt.toISOString(),
          gotResponse: c.gotResponse,
          notes: c.notes,
          contactedByName: c.contactedByUser.name,
          contactedByUserId: c.contactedByUser.id,
        })),
        systemUser: enrollment
          ? {
              userId: enrollment.matchedUserId,
              userName: enrollment.matchedUserName,
              studentId: enrollment.studentId,
              enrolledInCurrentCycle: enrollment.enrolledInCurrentCycle,
              enrollments: enrollment.enrollments,
            }
          : null,
      };
    }),
  });
}

const createContactSchema = z.object({
  interestId: z.string().uuid("Pré-inscrição inválida."),
  gotResponse: z.boolean(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v)),
});

/** Registra um contato da equipe com o interessado. */
export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "SITE_ADMIN"]);

  const body = await request.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const interest = await prisma.nextCycleInterest.findUnique({
    where: { id: parsed.data.interestId },
    select: { id: true },
  });
  if (!interest) return jsonErr("NOT_FOUND", "Pré-inscrição não encontrada.", 404);

  const contact = await prisma.nextCycleInterestContact.create({
    data: {
      interestId: parsed.data.interestId,
      contactedByUserId: user.id,
      gotResponse: parsed.data.gotResponse,
      notes: parsed.data.notes,
    },
    select: {
      id: true,
      contactedAt: true,
      gotResponse: true,
      notes: true,
      contactedByUser: { select: { id: true, name: true } },
    },
  });

  return jsonOk(
    {
      contact: {
        id: contact.id,
        contactedAt: contact.contactedAt.toISOString(),
        gotResponse: contact.gotResponse,
        notes: contact.notes,
        contactedByName: contact.contactedByUser.name,
        contactedByUserId: contact.contactedByUser.id,
      },
    },
    { status: 201 },
  );
}
