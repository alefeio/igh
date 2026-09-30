import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireSessionUser } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { maybeSendBirthdayGreetingForUser } from "@/lib/birthday-notifications";
import {
  birthDateInputToDate,
  birthDateToInputValue,
  optionalBirthDateSchema,
} from "@/lib/validators/person-contact";
import { z } from "zod";

const httpsOrEmpty = z
  .union([z.literal(""), z.null(), z.string().trim().url("URL inválida")])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return v;
  });

const patchSchema = z.object({
  photoUrl: httpsOrEmpty,
  signatureUrl: httpsOrEmpty,
  birthDate: optionalBirthDateSchema,
});

export async function GET() {
  let user;
  try {
    user = await requireSessionUser();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const [account, employee, teacher] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { birthDate: true },
    }),
    prisma.employee.findFirst({
      where: { userId: user.id, deletedAt: null, status: { not: "DESLIGADO" } },
      select: { photoUrl: true, birthDate: true },
    }),
    prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { photoUrl: true, signatureUrl: true },
    }),
  ]);

  return jsonOk({
    photoUrl: employee?.photoUrl ?? teacher?.photoUrl ?? null,
    signatureUrl: teacher?.signatureUrl ?? null,
    canEditPhoto: Boolean(employee || teacher),
    canEditSignature: Boolean(teacher),
    birthDate: birthDateToInputValue(account?.birthDate ?? employee?.birthDate ?? null),
  });
}

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireSessionUser();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  const [employee, teacher] = await Promise.all([
    prisma.employee.findFirst({
      where: { userId: user.id, deletedAt: null, status: { not: "DESLIGADO" } },
      select: { id: true },
    }),
    prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (data.photoUrl !== undefined && !employee && !teacher) {
    return jsonErr("FORBIDDEN", "Não há ficha para salvar a foto.", 403);
  }
  if (data.signatureUrl !== undefined && !teacher) {
    return jsonErr("FORBIDDEN", "A assinatura fica disponível no perfil de professor.", 403);
  }

  const birthDate = data.birthDate !== undefined ? birthDateInputToDate(data.birthDate) : undefined;

  await prisma.$transaction(async (tx) => {
    if (birthDate !== undefined) {
      await tx.user.update({
        where: { id: user.id },
        data: { birthDate },
      });
      if (employee) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { birthDate },
        });
      }
      const student = await tx.student.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (student && birthDate) {
        await tx.student.update({
          where: { id: student.id },
          data: { birthDate },
        });
      }
    }

    if (data.photoUrl !== undefined) {
      if (employee) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { photoUrl: data.photoUrl },
        });
      }
      if (teacher) {
        await tx.teacher.update({
          where: { id: teacher.id },
          data: { photoUrl: data.photoUrl },
        });
      }
    }

    if (data.signatureUrl !== undefined && teacher) {
      await tx.teacher.update({
        where: { id: teacher.id },
        data: { signatureUrl: data.signatureUrl },
      });
    }
  });

  if (birthDate !== undefined) {
    await maybeSendBirthdayGreetingForUser(user.id);
  }

  return jsonOk({ ok: true });
}
