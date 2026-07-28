import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

/** Cookie + localStorage: sobrevive à navegação até o cadastro. */
export const REFERRAL_COOKIE_NAME = "referral_code";
export const REFERRAL_STORAGE_KEY = "referral_code";
/** 90 dias. */
export const REFERRAL_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;

export const STUDENT_REFERRAL_POINTS = {
  registration: 50,
  firstAttendance: 100,
  subsequentAttendance: 5,
  certification: 200,
} as const;

function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toLowerCase();
  if (!code || code.length < 4 || code.length > 32) return null;
  if (!/^[a-z0-9_-]+$/.test(code)) return null;
  return code;
}

export function generateReferralCode(): string {
  return randomBytes(5).toString("hex"); // 10 chars hex
}

/** Garante que o usuário tem um código de indicação persistido. */
export async function ensureUserReferralCode(userId: string): Promise<string> {
  const existing = await prisma.userReferralCode.findUnique({
    where: { userId },
    select: { code: true },
  });
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    try {
      const created = await prisma.userReferralCode.create({
        data: { userId, code },
        select: { code: true },
      });
      return created.code;
    } catch {
      // colisão rara de unique — tenta de novo
    }
  }
  throw new Error("Não foi possível gerar código de indicação.");
}

export async function findReferrerUserIdByCode(rawCode: string | null | undefined): Promise<string | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const row = await prisma.userReferralCode.findUnique({
    where: { code },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

/** Lê o código do cookie da request (server). */
export async function readReferralCodeFromCookies(): Promise<string | null> {
  try {
    const jar = await cookies();
    return normalizeReferralCode(jar.get(REFERRAL_COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

/**
 * Resolve o indicador a partir do body da API e/ou cookie.
 * Ignora se o indicador for o próprio usuário (autoindicação).
 */
export async function resolveReferrerUserId(opts: {
  referralCodeFromBody?: string | null;
  excludeUserId?: string | null;
  /** Default true. Desligar em APIs internas (ex.: staff) para não usar cookie do operador. */
  allowCookie?: boolean;
}): Promise<string | null> {
  const fromBody = normalizeReferralCode(opts.referralCodeFromBody);
  const fromCookie =
    fromBody || opts.allowCookie === false ? null : await readReferralCodeFromCookies();
  const code = fromBody ?? fromCookie;
  if (!code) return null;
  const referrerUserId = await findReferrerUserIdByCode(code);
  if (!referrerUserId) return null;
  if (opts.excludeUserId && referrerUserId === opts.excludeUserId) return null;
  return referrerUserId;
}

/** Grava quem indicou o User (1×; não sobrescreve). */
export async function attachReferrerToUser(userId: string, referrerUserId: string | null): Promise<void> {
  if (!referrerUserId || referrerUserId === userId) return;
  await prisma.user.updateMany({
    where: { id: userId, referredByUserId: null },
    data: { referredByUserId: referrerUserId },
  });
}

/**
 * Cria StudentReferral na criação do aluno.
 * Fontes: referrer explícito, User.referredByUserId, ou código body/cookie.
 */
export async function attributeStudentReferral(opts: {
  studentId: string;
  studentUserId?: string | null;
  referralCodeFromBody?: string | null;
  /** Default true. Desligar em APIs de staff. */
  allowCookie?: boolean;
}): Promise<void> {
  const existing = await prisma.studentReferral.findUnique({
    where: { referredStudentId: opts.studentId },
    select: { id: true },
  });
  if (existing) return;

  let referrerUserId: string | null = null;

  if (opts.studentUserId) {
    const u = await prisma.user.findUnique({
      where: { id: opts.studentUserId },
      select: { referredByUserId: true },
    });
    referrerUserId = u?.referredByUserId ?? null;
  }

  if (!referrerUserId) {
    referrerUserId = await resolveReferrerUserId({
      referralCodeFromBody: opts.referralCodeFromBody,
      excludeUserId: opts.studentUserId,
      allowCookie: opts.allowCookie,
    });
  }

  if (!referrerUserId) return;
  if (opts.studentUserId && referrerUserId === opts.studentUserId) return;

  try {
    await prisma.studentReferral.create({
      data: {
        referrerUserId,
        referredStudentId: opts.studentId,
      },
    });
  } catch {
    // unique race — ignore
  }
}

/** Marca 1ª presença do indicado (idempotente). */
export async function markReferralFirstAttendance(studentId: string): Promise<void> {
  await prisma.studentReferral.updateMany({
    where: { referredStudentId: studentId, firstAttendanceAt: null },
    data: { firstAttendanceAt: new Date() },
  });
}

/**
 * Após salvar frequência: marca 1ª presença para indicados que já tenham
 * ao menos um SessionAttendance.present = true nas matrículas informadas.
 */
export async function markReferralFirstAttendanceForPresentEnrollments(
  enrollmentIds: string[],
): Promise<void> {
  const unique = [...new Set(enrollmentIds.filter(Boolean))];
  if (unique.length === 0) return;
  const rows = await prisma.enrollment.findMany({
    where: {
      id: { in: unique },
      sessionAttendances: { some: { present: true } },
    },
    select: { studentId: true },
  });
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  if (studentIds.length === 0) return;
  await prisma.studentReferral.updateMany({
    where: { referredStudentId: { in: studentIds }, firstAttendanceAt: null },
    data: { firstAttendanceAt: new Date() },
  });
}

/** Marca certificação do indicado (idempotente). */
export async function markReferralCertified(studentId: string): Promise<void> {
  await prisma.studentReferral.updateMany({
    where: { referredStudentId: studentId, certifiedAt: null },
    data: { certifiedAt: new Date() },
  });
}

export async function markReferralCertifiedForStudentIds(studentIds: string[]): Promise<void> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.studentReferral.updateMany({
    where: { referredStudentId: { in: unique }, certifiedAt: null },
    data: { certifiedAt: new Date() },
  });
}

export type ReferralListItem = {
  id: string;
  studentId: string;
  studentName: string;
  registeredAt: string;
  firstAttendanceAt: string | null;
  certifiedAt: string | null;
  attendancePresentCount: number;
  pointsEarned: number;
};

export function computeReferralPoints(opts: {
  hasRegistration: boolean;
  firstAttendanceAt: Date | null;
  certifiedAt: Date | null;
  attendancePresentCount: number;
}): number {
  let points = 0;
  if (opts.hasRegistration) points += STUDENT_REFERRAL_POINTS.registration;
  if (opts.firstAttendanceAt) {
    points += STUDENT_REFERRAL_POINTS.firstAttendance;
    const subsequent = Math.max(0, opts.attendancePresentCount - 1);
    points += subsequent * STUDENT_REFERRAL_POINTS.subsequentAttendance;
  }
  if (opts.certifiedAt) points += STUDENT_REFERRAL_POINTS.certification;
  return points;
}

export async function listReferralsForUser(referrerUserId: string): Promise<{
  items: ReferralListItem[];
  totals: {
    registered: number;
    firstAttendance: number;
    certified: number;
    points: number;
  };
  code: string;
}> {
  const code = await ensureUserReferralCode(referrerUserId);
  const rows = await prisma.studentReferral.findMany({
    where: { referrerUserId },
    orderBy: { registeredAt: "desc" },
    include: {
      referredStudent: { select: { id: true, name: true, deletedAt: true } },
    },
  });

  const studentIds = rows.map((r) => r.referredStudentId);
  const attendanceCounts = new Map<string, number>();
  if (studentIds.length > 0) {
    const grouped = await prisma.sessionAttendance.groupBy({
      by: ["enrollmentId"],
      where: {
        present: true,
        enrollment: { studentId: { in: studentIds } },
      },
      _count: { _all: true },
    });
    const enrollmentToStudent = await prisma.enrollment.findMany({
      where: { id: { in: grouped.map((g) => g.enrollmentId) } },
      select: { id: true, studentId: true },
    });
    const enrMap = new Map(enrollmentToStudent.map((e) => [e.id, e.studentId]));
    for (const g of grouped) {
      const sid = enrMap.get(g.enrollmentId);
      if (!sid) continue;
      attendanceCounts.set(sid, (attendanceCounts.get(sid) ?? 0) + g._count._all);
    }
  }

  const items: ReferralListItem[] = rows
    .filter((r) => !r.referredStudent.deletedAt)
    .map((r) => {
      const attendancePresentCount = attendanceCounts.get(r.referredStudentId) ?? 0;
      const pointsEarned = computeReferralPoints({
        hasRegistration: true,
        firstAttendanceAt: r.firstAttendanceAt,
        certifiedAt: r.certifiedAt,
        attendancePresentCount,
      });
      return {
        id: r.id,
        studentId: r.referredStudentId,
        studentName: r.referredStudent.name,
        registeredAt: r.registeredAt.toISOString(),
        firstAttendanceAt: r.firstAttendanceAt?.toISOString() ?? null,
        certifiedAt: r.certifiedAt?.toISOString() ?? null,
        attendancePresentCount,
        pointsEarned,
      };
    });

  const totals = {
    registered: items.length,
    firstAttendance: items.filter((i) => i.firstAttendanceAt).length,
    certified: items.filter((i) => i.certifiedAt).length,
    points: items.reduce((s, i) => s + i.pointsEarned, 0),
  };

  return { items, totals, code };
}

/** Agrega pontos de indicação por studentId do indicador (para o ranking). */
export async function getReferralPointsByReferrerStudentIds(
  referrerStudentIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (referrerStudentIds.length === 0) return result;

  const referrers = await prisma.student.findMany({
    where: { id: { in: referrerStudentIds }, deletedAt: null, userId: { not: null } },
    select: { id: true, userId: true },
  });
  const userToStudent = new Map(
    referrers.filter((s) => s.userId).map((s) => [s.userId!, s.id]),
  );
  const userIds = [...userToStudent.keys()];
  if (userIds.length === 0) return result;

  const referrals = await prisma.studentReferral.findMany({
    where: { referrerUserId: { in: userIds } },
    select: {
      referrerUserId: true,
      referredStudentId: true,
      firstAttendanceAt: true,
      certifiedAt: true,
    },
  });
  if (referrals.length === 0) return result;

  const referredIds = [...new Set(referrals.map((r) => r.referredStudentId))];
  const attendanceCounts = new Map<string, number>();
  const grouped = await prisma.sessionAttendance.groupBy({
    by: ["enrollmentId"],
    where: {
      present: true,
      enrollment: { studentId: { in: referredIds } },
    },
    _count: { _all: true },
  });
  const enrollmentToStudent = await prisma.enrollment.findMany({
    where: { id: { in: grouped.map((g) => g.enrollmentId) } },
    select: { id: true, studentId: true },
  });
  const enrMap = new Map(enrollmentToStudent.map((e) => [e.id, e.studentId]));
  for (const g of grouped) {
    const sid = enrMap.get(g.enrollmentId);
    if (!sid) continue;
    attendanceCounts.set(sid, (attendanceCounts.get(sid) ?? 0) + g._count._all);
  }

  const pointsByUser = new Map<string, number>();
  for (const r of referrals) {
    const pts = computeReferralPoints({
      hasRegistration: true,
      firstAttendanceAt: r.firstAttendanceAt,
      certifiedAt: r.certifiedAt,
      attendancePresentCount: attendanceCounts.get(r.referredStudentId) ?? 0,
    });
    pointsByUser.set(r.referrerUserId, (pointsByUser.get(r.referrerUserId) ?? 0) + pts);
  }

  for (const [userId, studentId] of userToStudent) {
    result.set(studentId, pointsByUser.get(userId) ?? 0);
  }
  return result;
}
