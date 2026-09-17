import "server-only";

import { getCurrentCycleId } from "@/lib/current-cycle";
import { prisma } from "@/lib/prisma";
import { formatDaysShortPtBr } from "@/lib/turma-display";

export type NextCycleInterestEnrollmentInfo = {
  matchedUserId: string;
  matchedUserName: string;
  studentId: string | null;
  enrolledInCurrentCycle: boolean;
  enrollments: Array<{
    enrollmentId: string;
    status: string;
    isPreEnrollment: boolean;
    courseName: string;
    classGroupLabel: string;
  }>;
};

function normalizeEmail(value: string | null | undefined): string | null {
  const t = value?.trim().toLowerCase();
  return t && t.includes("@") ? t : null;
}

function normalizePhoneDigits(value: string | null | undefined): string | null {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  // Compara pelos últimos 11 ou 10 dígitos (ignora 55 do país).
  if (d.startsWith("55") && d.length >= 12) return d.slice(-11);
  return d.slice(-11);
}

/**
 * Cruza e-mail/telefone da pré-inscrição com User/Student e matrículas do ciclo atual.
 */
export async function resolveNextCycleInterestEnrollmentMap(
  interests: Array<{ id: string; email: string; phone: string }>,
): Promise<Map<string, NextCycleInterestEnrollmentInfo>> {
  const result = new Map<string, NextCycleInterestEnrollmentInfo>();
  if (interests.length === 0) return result;

  const emails = [
    ...new Set(interests.map((i) => normalizeEmail(i.email)).filter((e): e is string => Boolean(e))),
  ];
  const phones = [
    ...new Set(
      interests.map((i) => normalizePhoneDigits(i.phone)).filter((p): p is string => Boolean(p)),
    ),
  ];

  const currentCycleId = await getCurrentCycleId();

  const users =
    emails.length === 0 && phones.length === 0
      ? []
      : await prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              ...(emails.length
                ? [
                    { email: { in: emails, mode: "insensitive" as const } },
                    { student: { email: { in: emails, mode: "insensitive" as const } } },
                  ]
                : []),
              ...(phones.length
                ? [
                    ...phones.map((p) => ({ whatsapp: { endsWith: p } })),
                    ...phones.map((p) => ({ student: { phone: { endsWith: p } } })),
                  ]
                : []),
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            whatsapp: true,
            student: {
              select: {
                id: true,
                deletedAt: true,
                email: true,
                phone: true,
                enrollments: {
                  where: currentCycleId
                    ? {
                        classGroup: { cycleId: currentCycleId },
                        status: { in: ["ACTIVE", "SUSPENDED", "COMPLETED"] },
                      }
                    : { id: "__none__" },
                  select: {
                    id: true,
                    status: true,
                    isPreEnrollment: true,
                    classGroup: {
                      select: {
                        location: true,
                        daysOfWeek: true,
                        startTime: true,
                        endTime: true,
                        course: { select: { name: true } },
                      },
                    },
                  },
                  orderBy: { enrolledAt: "desc" },
                },
              },
            },
          },
        });

  const byEmail = new Map<string, (typeof users)[number]>();
  const byPhone = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    const em = normalizeEmail(u.email);
    const ph = normalizePhoneDigits(u.whatsapp);
    if (em) byEmail.set(em, u);
    if (ph) byPhone.set(ph, u);
    const studentEm = normalizeEmail(u.student?.email);
    const studentPh = normalizePhoneDigits(u.student?.phone);
    if (studentEm) byEmail.set(studentEm, u);
    if (studentPh) byPhone.set(studentPh, u);
  }

  for (const interest of interests) {
    const em = normalizeEmail(interest.email);
    const ph = normalizePhoneDigits(interest.phone);
    const user = (em ? byEmail.get(em) : undefined) ?? (ph ? byPhone.get(ph) : undefined);
    if (!user) continue;

    const student = user.student && !user.student.deletedAt ? user.student : null;
    const enrollmentsRaw = student?.enrollments ?? [];
    const enrollments = enrollmentsRaw.map((e) => {
      const days = formatDaysShortPtBr(e.classGroup.daysOfWeek);
      const time =
        e.classGroup.startTime && e.classGroup.endTime
          ? `${e.classGroup.startTime}–${e.classGroup.endTime}`
          : "";
      const loc = e.classGroup.location?.trim() || "";
      return {
        enrollmentId: e.id,
        status: e.status,
        isPreEnrollment: e.isPreEnrollment,
        courseName: e.classGroup.course.name,
        classGroupLabel: [loc, days, time].filter(Boolean).join(" · ") || "Turma",
      };
    });

    result.set(interest.id, {
      matchedUserId: user.id,
      matchedUserName: user.name,
      studentId: student?.id ?? null,
      enrolledInCurrentCycle: enrollments.some((e) => e.status === "ACTIVE" && !e.isPreEnrollment),
      enrollments,
    });
  }

  return result;
}
