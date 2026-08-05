import "server-only";

import { prisma } from "@/lib/prisma";
import { PUBLIC_INSCREVA_STATUSES } from "@/lib/public-enrollment-availability";

const WAITLIST_ELIGIBLE_STATUSES = ["ABERTA", "EM_ANDAMENTO", "PLANEJADA"] as const;

export async function assertCanJoinWaitlist(args: {
  studentId: string;
  classGroupId: string;
  /** Público: mesmos status de /inscreva; admin pode nas elegíveis. */
  publicOnly?: boolean;
}): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  const student = await prisma.student.findFirst({
    where: { id: args.studentId, deletedAt: null },
    select: { id: true },
  });
  if (!student) {
    return { ok: false, code: "NOT_FOUND", message: "Aluno não encontrado. Cadastre o aluno antes da reserva.", status: 404 };
  }

  const classGroup = await prisma.classGroup.findUnique({
    where: { id: args.classGroupId },
    select: {
      id: true,
      capacity: true,
      status: true,
      isExternal: true,
      course: { select: { status: true } },
      cycle: { select: { isVisibleForEnrollments: true } },
    },
  });
  if (!classGroup) {
    return { ok: false, code: "NOT_FOUND", message: "Turma não encontrada.", status: 404 };
  }

  if (args.publicOnly) {
    if (classGroup.isExternal) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Esta turma não está disponível para inscrição pública.",
        status: 403,
      };
    }
    if (!(PUBLIC_INSCREVA_STATUSES as readonly string[]).includes(classGroup.status)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Esta turma não está aceitando reservas no momento.",
        status: 400,
      };
    }
    if (classGroup.course.status !== "ACTIVE") {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Este curso não está disponível para inscrição.",
        status: 400,
      };
    }
    if (!classGroup.cycle.isVisibleForEnrollments) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Esta turma não está disponível para inscrição pública.",
        status: 400,
      };
    }
  } else if (!(WAITLIST_ELIGIBLE_STATUSES as readonly string[]).includes(classGroup.status)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Esta turma não está aceitando reservas no momento.",
      status: 400,
    };
  }

  const activeCount = await prisma.enrollment.count({
    where: { classGroupId: args.classGroupId, status: "ACTIVE" },
  });
  if (activeCount < classGroup.capacity) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Esta turma ainda possui vagas. Faça a matrícula normal em vez da reserva.",
      status: 400,
    };
  }

  const activeEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: args.studentId, classGroupId: args.classGroupId, status: "ACTIVE" },
    select: { id: true },
  });
  if (activeEnrollment) {
    return {
      ok: false,
      code: "DUPLICATE",
      message: "Este aluno já está matriculado nesta turma.",
      status: 409,
    };
  }

  const existingWait = await prisma.enrollmentWaitlist.findFirst({
    where: {
      studentId: args.studentId,
      classGroupId: args.classGroupId,
      status: "WAITING",
    },
    select: { id: true },
  });
  if (existingWait) {
    return {
      ok: false,
      code: "DUPLICATE",
      message: "Este aluno já está na lista de espera desta turma.",
      status: 409,
    };
  }

  return { ok: true };
}

export async function createWaitlistEntry(args: {
  studentId: string;
  classGroupId: string;
  notes?: string | null;
}) {
  // Reativa reserva cancelada do mesmo aluno/turma, se existir.
  const previous = await prisma.enrollmentWaitlist.findUnique({
    where: {
      classGroupId_studentId: {
        classGroupId: args.classGroupId,
        studentId: args.studentId,
      },
    },
  });

  if (previous) {
    return prisma.enrollmentWaitlist.update({
      where: { id: previous.id },
      data: {
        status: "WAITING",
        notes: args.notes?.trim() || previous.notes,
        convertedEnrollmentId: null,
      },
      include: {
        student: { select: { id: true, name: true, email: true, phone: true } },
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
          },
        },
      },
    });
  }

  return prisma.enrollmentWaitlist.create({
    data: {
      studentId: args.studentId,
      classGroupId: args.classGroupId,
      status: "WAITING",
      notes: args.notes?.trim() || null,
    },
    include: {
      student: { select: { id: true, name: true, email: true, phone: true } },
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
        },
      },
    },
  });
}
