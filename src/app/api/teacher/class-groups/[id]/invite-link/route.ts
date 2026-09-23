import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import {
  classGroupInvitePublicPath,
  generateClassGroupInviteToken,
} from "@/lib/class-group-invite";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

async function resolveTeacherOwnedClassGroup(classGroupId: string) {
  const user = await requireRole(["TEACHER"]);
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    return { error: jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403) as Response };
  }

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
    select: {
      id: true,
      capacity: true,
      status: true,
      enrollmentInviteToken: true,
      course: { select: { name: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } } },
        },
      },
    },
  });
  if (!cg) {
    return { error: jsonErr("NOT_FOUND", "Turma não encontrada.", 404) as Response };
  }

  return { user, teacher, cg };
}

function invitePayload(cg: {
  id: string;
  capacity: number;
  status: string;
  enrollmentInviteToken: string | null;
  course: { name: string };
  _count: { enrollments: number };
}) {
  const occupied = cg._count.enrollments;
  const seatsRemaining = Math.max(0, cg.capacity - occupied);
  const token = cg.enrollmentInviteToken;
  return {
    classGroupId: cg.id,
    courseName: cg.course.name,
    status: cg.status,
    capacity: cg.capacity,
    occupiedSeats: occupied,
    seatsRemaining,
    token,
    path: token ? classGroupInvitePublicPath(token) : null,
  };
}

/** GET: token/link atual + vagas. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: classGroupId } = await context.params;
  const resolved = await resolveTeacherOwnedClassGroup(classGroupId);
  if ("error" in resolved && resolved.error) return resolved.error;

  let { cg } = resolved;
  if (!cg.enrollmentInviteToken) {
    const token = generateClassGroupInviteToken();
    cg = await prisma.classGroup.update({
      where: { id: cg.id },
      data: { enrollmentInviteToken: token },
      select: {
        id: true,
        capacity: true,
        status: true,
        enrollmentInviteToken: true,
        course: { select: { name: true } },
        _count: {
          select: {
            enrollments: { where: { status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } } },
          },
        },
      },
    });
  }

  return jsonOk({ invite: invitePayload(cg) });
}

/** POST: regenera o token do link. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: classGroupId } = await context.params;
  const resolved = await resolveTeacherOwnedClassGroup(classGroupId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const token = generateClassGroupInviteToken();
  const cg = await prisma.classGroup.update({
    where: { id: resolved.cg.id },
    data: { enrollmentInviteToken: token },
    select: {
      id: true,
      capacity: true,
      status: true,
      enrollmentInviteToken: true,
      course: { select: { name: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } } },
        },
      },
    },
  });

  return jsonOk({ invite: invitePayload(cg) });
}
