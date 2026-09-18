import "server-only";

import { getCurrentCycleId } from "@/lib/current-cycle";
import { prisma } from "@/lib/prisma";
import { formatDaysShortPtBr } from "@/lib/turma-display";

export type NextCycleInterestEnrollmentInfo = {
  matchedUserId: string | null;
  matchedUserName: string;
  studentId: string | null;
  /** Tem matrícula ACTIVE no último ciclo cadastrado (inclui pré-matrícula). */
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

/** Chaves de telefone para cruzamento (últimos 11, 10 e 9 dígitos). */
function phoneMatchKeys(value: string | null | undefined): string[] {
  let d = (value ?? "").replace(/\D/g, "");
  if (d.length < 10) return [];
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  const keys = new Set<string>();
  if (d.length >= 11) keys.add(d.slice(-11));
  if (d.length >= 10) keys.add(d.slice(-10));
  if (d.length >= 9) keys.add(d.slice(-9));
  return [...keys];
}

function formatEnrollmentRow(e: {
  id: string;
  status: string;
  isPreEnrollment: boolean;
  classGroup: {
    location: string | null;
    daysOfWeek: string[];
    startTime: string;
    endTime: string;
    course: { name: string };
  };
}) {
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
}

type Match = {
  studentId: string | null;
  userId: string | null;
  displayName: string;
  enrollments: ReturnType<typeof formatEnrollmentRow>[];
};

/**
 * Cruza e-mail/telefone da pré-inscrição com Student (e User vinculado)
 * e matrículas do ciclo atual = último ciclo cadastrado (maior ano/número).
 */
export async function resolveNextCycleInterestEnrollmentMap(
  interests: Array<{ id: string; email: string; phone: string }>,
): Promise<Map<string, NextCycleInterestEnrollmentInfo>> {
  const result = new Map<string, NextCycleInterestEnrollmentInfo>();
  if (interests.length === 0) return result;

  const emails = [
    ...new Set(interests.map((i) => normalizeEmail(i.email)).filter((e): e is string => Boolean(e))),
  ];
  const allPhoneKeys = [...new Set(interests.flatMap((i) => phoneMatchKeys(i.phone)))];

  const currentCycleId = await getCurrentCycleId();

  const enrollmentSelect = {
    id: true,
    status: true,
    isPreEnrollment: true,
    enrolledAt: true,
    classGroup: {
      select: {
        location: true,
        daysOfWeek: true,
        startTime: true,
        endTime: true,
        course: { select: { name: true } },
      },
    },
  } as const;

  const students =
    emails.length === 0 && allPhoneKeys.length === 0
      ? []
      : await prisma.student.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(emails.length
                ? [{ email: { in: emails, mode: "insensitive" as const } }]
                : []),
              ...(allPhoneKeys.length
                ? allPhoneKeys.map((p) => ({ phone: { endsWith: p } }))
                : []),
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            userId: true,
            user: {
              select: { id: true, name: true, email: true, whatsapp: true, isActive: true },
            },
            enrollments: {
              where: currentCycleId
                ? {
                    classGroup: { cycleId: currentCycleId },
                    status: { in: ["ACTIVE", "SUSPENDED", "COMPLETED"] },
                  }
                : { id: "__none__" },
              select: enrollmentSelect,
              orderBy: [{ isPreEnrollment: "asc" }, { enrolledAt: "desc" }],
            },
          },
        });

  const usersWithoutStudent =
    emails.length === 0 && allPhoneKeys.length === 0
      ? []
      : await prisma.user.findMany({
          where: {
            isActive: true,
            student: null,
            OR: [
              ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
              ...(allPhoneKeys.length
                ? allPhoneKeys.map((p) => ({ whatsapp: { endsWith: p } }))
                : []),
            ],
          },
          select: { id: true, name: true, email: true, whatsapp: true },
        });

  const byEmail = new Map<string, Match>();
  const byPhoneKey = new Map<string, Match>();

  function indexMatch(match: Match, email: string | null | undefined, phone: string | null | undefined) {
    const em = normalizeEmail(email);
    // Preferência: match com studentId sobre match só de user.
    if (em) {
      const prev = byEmail.get(em);
      if (!prev || (!prev.studentId && match.studentId)) byEmail.set(em, match);
    }
    for (const key of phoneMatchKeys(phone)) {
      const prev = byPhoneKey.get(key);
      if (!prev || (!prev.studentId && match.studentId)) byPhoneKey.set(key, match);
    }
  }

  for (const s of students) {
    const match: Match = {
      studentId: s.id,
      userId: s.user?.isActive === false ? null : (s.user?.id ?? s.userId),
      displayName: s.user?.name ?? s.name,
      enrollments: s.enrollments.map(formatEnrollmentRow),
    };
    indexMatch(match, s.email, s.phone);
    if (s.user) indexMatch(match, s.user.email, s.user.whatsapp);
  }

  for (const u of usersWithoutStudent) {
    const match: Match = {
      studentId: null,
      userId: u.id,
      displayName: u.name,
      enrollments: [],
    };
    indexMatch(match, u.email, u.whatsapp);
  }

  for (const interest of interests) {
    const em = normalizeEmail(interest.email);
    const keys = phoneMatchKeys(interest.phone);
    let match = em ? byEmail.get(em) : undefined;
    if (!match) {
      for (const k of keys) {
        match = byPhoneKey.get(k);
        if (match) break;
      }
    }
    if (!match) continue;

    result.set(interest.id, {
      matchedUserId: match.userId,
      matchedUserName: match.displayName,
      studentId: match.studentId,
      enrolledInCurrentCycle: match.enrollments.some((e) => e.status === "ACTIVE"),
      enrollments: match.enrollments,
    });
  }

  return result;
}
