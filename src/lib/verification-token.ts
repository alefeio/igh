import "server-only";

import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { VerificationTokenType } from "@/generated/prisma/client";

const TOKEN_BYTES = 32;
const EXPIRY_DAYS = 7;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSecureToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export async function createVerificationToken(params: {
  userId: string;
  type: VerificationTokenType;
  studentId?: string | null;
  enrollmentId?: string | null;
  expiresInDays?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const { userId, type, studentId, enrollmentId, expiresInDays = EXPIRY_DAYS } = params;
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await prisma.verificationToken.create({
    data: {
      userId,
      studentId: studentId ?? undefined,
      enrollmentId: enrollmentId ?? undefined,
      type,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function consumeVerificationToken(params: {
  rawToken: string;
  type: VerificationTokenType;
}): Promise<{ userId: string; studentId: string | null; enrollmentId: string | null } | null> {
  const { rawToken, type } = params;
  const tokenHash = hashToken(rawToken);

  const record = await prisma.verificationToken.findFirst({
    where: {
      type,
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true, studentId: true, enrollmentId: true },
  });

  if (!record) return null;

  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return {
    userId: record.userId,
    studentId: record.studentId,
    enrollmentId: record.enrollmentId,
  };
}

export async function findTokenByRaw(params: {
  rawToken: string;
  type: VerificationTokenType;
}): Promise<{ valid: boolean; userId?: string; studentId?: string | null; enrollmentId?: string | null }> {
  const { rawToken, type } = params;
  const tokenHash = hashToken(rawToken);

  const record = await prisma.verificationToken.findFirst({
    where: { type, tokenHash },
    select: { userId: true, studentId: true, enrollmentId: true, usedAt: true, expiresAt: true },
  });

  if (!record) return { valid: false };
  if (record.usedAt || record.expiresAt < new Date()) return { valid: false };

  return {
    valid: true,
    userId: record.userId,
    studentId: record.studentId ?? undefined,
    enrollmentId: record.enrollmentId ?? undefined,
  };
}
