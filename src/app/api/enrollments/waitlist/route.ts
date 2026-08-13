import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { createWaitlistSchema } from "@/lib/validators/waitlist";
import { assertCanJoinWaitlist, createWaitlistEntry } from "@/lib/enrollment-waitlist-create";
import {
  buildClassGroupWhereForPoloCoordinator,
  poloCoordinatorOwnsClassGroup,
} from "@/lib/polo-coordinator-scope";
import {
  classGroupTeacherAccessWhere,
  resolveTeacherIdForUser,
  teacherOwnsClassGroup,
} from "@/lib/class-group-teachers";
import type { Prisma } from "@/generated/prisma/client";

/** Lista reservas (WAITING por padrão). Query: classGroupId, status, all=1. */
export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "POLO_COORDINATOR", "TEACHER"]);
  const url = new URL(request.url);
  const classGroupId = url.searchParams.get("classGroupId")?.trim() || null;
  const status = url.searchParams.get("status")?.trim() || "WAITING";
  const all = url.searchParams.get("all") === "1";

  const isPolo = user.role === "POLO_COORDINATOR";
  const isTeacher = user.role === "TEACHER";

  let classGroupScope: Prisma.EnrollmentWaitlistWhereInput | undefined;
  if (isPolo) {
    const poloWhere = await buildClassGroupWhereForPoloCoordinator(user.id);
    classGroupScope = { classGroup: poloWhere };
  } else if (isTeacher) {
    const teacherId = await resolveTeacherIdForUser(user.id);
    if (!teacherId) {
      return jsonOk({ waitlist: [] });
    }
    classGroupScope = { classGroup: classGroupTeacherAccessWhere(teacherId) };
  }

  const entries = await prisma.enrollmentWaitlist.findMany({
    where: {
      ...(all ? {} : { status }),
      ...(classGroupId ? { classGroupId } : {}),
      ...(classGroupScope ?? {}),
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      student: { select: { id: true, name: true, email: true, phone: true, cpf: true } },
      classGroup: {
        select: {
          id: true,
          startDate: true,
          startTime: true,
          endTime: true,
          daysOfWeek: true,
          location: true,
          capacity: true,
          status: true,
          course: { select: { id: true, name: true } },
          _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });

  return jsonOk({
    waitlist: entries.map((e) => {
      const position =
        entries.filter(
          (other) =>
            other.classGroupId === e.classGroupId &&
            other.createdAt.getTime() <= e.createdAt.getTime(),
        ).length;
      return {
        id: e.id,
        studentId: e.studentId,
        classGroupId: e.classGroupId,
        status: e.status,
        notes: e.notes,
        position,
        createdAt: e.createdAt.toISOString(),
        student: e.student,
        classGroup: {
          ...e.classGroup,
          activeEnrollments: e.classGroup._count.enrollments,
          seatsLeft: Math.max(0, e.classGroup.capacity - e.classGroup._count.enrollments),
        },
      };
    }),
  });
}

/** Cria cadastro de reserva (aluno já cadastrado; turma lotada). */
export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "POLO_COORDINATOR", "TEACHER"]);
  const body = await request.json().catch(() => null);
  const parsed = createWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { studentId, classGroupId, notes } = parsed.data;

  if (user.role === "POLO_COORDINATOR") {
    const ok = await poloCoordinatorOwnsClassGroup(user.id, classGroupId);
    if (!ok) {
      return jsonErr("FORBIDDEN", "Turma fora do escopo dos polos que você coordena.", 403);
    }
  }

  if (user.role === "TEACHER") {
    const teacherId = await resolveTeacherIdForUser(user.id);
    if (!teacherId) {
      return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);
    }
    const ok = await teacherOwnsClassGroup(teacherId, classGroupId);
    if (!ok) {
      return jsonErr("FORBIDDEN", "Você só pode cadastrar lista de espera nas turmas em que leciona.", 403);
    }
  }

  const check = await assertCanJoinWaitlist({ studentId, classGroupId });
  if (!check.ok) {
    return jsonErr(check.code, check.message, check.status);
  }

  const entry = await createWaitlistEntry({ studentId, classGroupId, notes });

  await createAuditLog({
    entityType: "EnrollmentWaitlist",
    entityId: entry.id,
    action: "CREATE",
    diff: { studentId, classGroupId },
    performedByUserId: user.id,
  });

  return jsonOk({ waitlist: entry }, { status: 201 });
}
