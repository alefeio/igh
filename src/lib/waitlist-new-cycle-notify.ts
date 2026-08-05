import "server-only";

import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { hasEmailPendingOrSent } from "@/lib/email/outbox";
import { templateWaitlistNewCycleOpen } from "@/lib/email/templates";
import { PUBLIC_INSCREVA_STATUSES } from "@/lib/public-enrollment-availability";

/**
 * Quando um ciclo passa a aceitar matrículas, avisa alunos que ficaram WAITING
 * em outros ciclos (sem matrícula convertida) sobre os cursos do novo ciclo.
 * Respeita a cota diária do Resend via sendEmailAndRecord (fila/outbox).
 */
export async function notifyWaitlistStudentsOfNewCycle(cycleId: string): Promise<{
  candidates: number;
  queuedOrSent: number;
  skipped: number;
}> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { id: true, cycle: true, year: true, isVisibleForEnrollments: true },
  });
  if (!cycle?.isVisibleForEnrollments) {
    return { candidates: 0, queuedOrSent: 0, skipped: 0 };
  }

  const cycleLabel = `Ciclo ${cycle.cycle}/${cycle.year}`;

  const classGroupsInCycle = await prisma.classGroup.findMany({
    where: {
      cycleId,
      status: { in: [...PUBLIC_INSCREVA_STATUSES] },
      isExternal: false,
      course: { status: "ACTIVE" },
    },
    select: {
      courseId: true,
      capacity: true,
      course: { select: { id: true, name: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });

  const courseMap = new Map<string, { name: string; hasOpenSeats: boolean }>();
  for (const cg of classGroupsInCycle) {
    const open = cg.enrollments.length < cg.capacity;
    const prev = courseMap.get(cg.courseId);
    if (!prev) {
      courseMap.set(cg.courseId, { name: cg.course.name, hasOpenSeats: open });
    } else if (open) {
      prev.hasOpenSeats = true;
    }
  }
  const courses = [...courseMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );

  // Alunos ainda WAITING em turmas de outros ciclos (não conseguiram vaga lá).
  const waiting = await prisma.enrollmentWaitlist.findMany({
    where: {
      status: "WAITING",
      classGroup: { cycleId: { not: cycleId } },
      student: { email: { not: null } },
    },
    select: {
      studentId: true,
      student: { select: { id: true, name: true, email: true } },
    },
    distinct: ["studentId"],
  });

  const inscrevaUrl = getAppUrl("/inscreva");
  let queuedOrSent = 0;
  let skipped = 0;

  for (const row of waiting) {
    const email = row.student.email?.trim();
    if (!email) {
      skipped += 1;
      continue;
    }

    const entityId = `${cycleId}:${row.studentId}`;
    const already = await hasEmailPendingOrSent({
      emailType: "waitlist_new_cycle_open",
      entityType: "Cycle",
      entityId,
    });
    if (already) {
      skipped += 1;
      continue;
    }

    // Já matriculado em alguma turma do novo ciclo? não precisa do aviso.
    const enrolledInNewCycle = await prisma.enrollment.findFirst({
      where: {
        studentId: row.studentId,
        status: "ACTIVE",
        classGroup: { cycleId },
      },
      select: { id: true },
    });
    if (enrolledInNewCycle) {
      skipped += 1;
      continue;
    }

    const { subject, html } = templateWaitlistNewCycleOpen({
      name: row.student.name,
      cycleLabel,
      courses,
      inscrevaUrl,
    });

    await sendEmailAndRecord({
      to: email,
      subject,
      html,
      emailType: "waitlist_new_cycle_open",
      entityType: "Cycle",
      entityId,
    });
    queuedOrSent += 1;
  }

  return { candidates: waiting.length, queuedOrSent, skipped };
}
