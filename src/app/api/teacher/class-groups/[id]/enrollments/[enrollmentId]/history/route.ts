import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { ENROLLMENT_HISTORY_BODY_MAX } from "@/lib/enrollment-history";
import { notifyEnrollmentHistoryEntry } from "@/lib/enrollment-history-notifications";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  buildAdministrativeRecord,
  CONTACT_RESULTS,
  CONTACT_TYPES,
  isBuscaAtivaEligible,
  MESSAGE_TEMPLATES,
  type ContactResult,
  type ContactType,
} from "@/lib/busca-ativa";
import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

async function loadOwnedEnrollment(userId: string, classGroupId: string, enrollmentId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return { error: jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403) };
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      classGroupId,
      status: { in: ["ACTIVE", "SUSPENDED", "CANCELLED"] },
      classGroup: classGroupTeacherAccessWhere(teacher.id),
    },
    select: {
      id: true,
      status: true,
      isPreEnrollment: true,
      updatedAt: true,
      classGroup: {
        select: {
          updatedAt: true,
          course: { select: { updatedAt: true } },
          cycle: { select: { updatedAt: true } },
          poloLocation: { select: { updatedAt: true } },
        },
      },
      student: { select: { updatedAt: true, deletedAt: true } },
    },
  });
  if (!enrollment) return { error: jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404) };
  return { enrollment, teacherId: teacher.id };
}

export async function POST(request: Request, ctx: Ctx) {
  const user = await requireRole(["TEACHER"]).catch(() => null);
  if (!user) return jsonErr("FORBIDDEN", "Acesso reservado aos professores autorizados.", 403);
  const { id: classGroupId, enrollmentId } = await ctx.params;
  const owned = await loadOwnedEnrollment(user.id, classGroupId, enrollmentId);
  if ("error" in owned && owned.error) return owned.error;

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (text.length < 2) {
    return jsonErr("VALIDATION_ERROR", "Escreva a informação da busca ativa.", 400);
  }
  if (text.length > ENROLLMENT_HISTORY_BODY_MAX) {
    return jsonErr("VALIDATION_ERROR", "Texto longo demais.", 400);
  }

  const structured = body?.contactType != null;
  if (structured && /{{[^}]*}}|\bundefined\b|\bnull\b/i.test(text))
    return jsonErr("VALIDATION_ERROR", "Revise os campos não resolvidos da mensagem.", 400);
  let contactType: ContactType | null = null;
  let result: ContactResult | null = null;
  let factDate: string | null = null;
  let channel: string | null = null;
  let templateId: string | null = null;
  let templateVersion: number | null = null;
  let requestId: string | null = null;
  let recordBody = text;
  if (structured) {
    if (
      !("enrollment" in owned) ||
      !owned.enrollment ||
      !isBuscaAtivaEligible({
        status: owned.enrollment.status,
        isPreEnrollment: owned.enrollment.isPreEnrollment,
        studentDeletedAt: owned.enrollment.student.deletedAt,
      })
    )
      return jsonErr("NOT_FOUND", "Matrícula indisponível para busca ativa.", 404);
    if (!CONTACT_TYPES.includes(body.contactType))
      return jsonErr("VALIDATION_ERROR", "Natureza do registro inválida.", 400);
    contactType = body.contactType;
    if (
      typeof body.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)
    )
      return jsonErr("VALIDATION_ERROR", "Identificador de registro inválido.", 400);
    requestId = body.requestId;
    if ("enrollment" in owned && owned.enrollment) {
      const e = owned.enrollment;
      const attendance = (await getEnrollmentAttendanceSummaries([enrollmentId])).get(enrollmentId);
      const revision = [
        user.id,
        user.name,
        e.classGroup.updatedAt.toISOString(),
        e.classGroup.course.updatedAt.toISOString(),
        e.classGroup.cycle.updatedAt.toISOString(),
        e.classGroup.poloLocation?.updatedAt.toISOString() ?? "",
        e.updatedAt.toISOString(),
        e.student.updatedAt.toISOString(),
        attendance?.presentCount ?? 0,
        attendance?.recordedCount ?? 0,
        attendance?.totalSessions ?? 0,
        attendance?.unjustifiedAbsenceCount ?? 0,
      ].join(":");
      if (body.revision !== revision)
        return jsonErr(
          "STALE_CONTEXT",
          "Os dados da turma ou matrícula mudaram. Atualize e revise antes de registrar.",
          409,
        );
    }
    if (body.templateId != null) {
      const template = MESSAGE_TEMPLATES.find((item) => item.id === body.templateId);
      if (!template || body.templateVersion !== template.version || template.audience === "turma")
        return jsonErr("VALIDATION_ERROR", "Modelo inválido para histórico individual.", 400);
      templateId = template.id;
      templateVersion = template.version;
    }
    const isContact = contactType === "CONTATO_REALIZADO" || contactType === "RETORNO_INFORMADO";
    if (isContact) {
      if (body.result != null && CONTACT_RESULTS.includes(body.result)) result = body.result;
      if (!result) return jsonErr("VALIDATION_ERROR", "Informe o resultado confirmado.", 400);
      if (
        typeof body.channel !== "string" ||
        !["WhatsApp", "Telefone", "Presencial", "Outro"].includes(body.channel)
      )
        return jsonErr("VALIDATION_ERROR", "Informe o canal do contato.", 400);
      channel = body.channel;
      if (typeof body.factDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.factDate)) {
        const parsed = new Date(`${body.factDate}T00:00:00.000Z`);
        if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === body.factDate)
          factDate = body.factDate;
      }
      if (!factDate) return jsonErr("VALIDATION_ERROR", "Informe a data do contato.", 400);
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
    recordBody = buildAdministrativeRecord({
      type: contactType!,
      text,
      factDate: factDate ?? undefined,
      channel: channel ?? undefined,
      result: result ?? undefined,
      note,
      authorName: user.name,
      templateId: templateId ?? undefined,
      templateVersion: templateVersion ?? undefined,
    });
    if (recordBody.length > ENROLLMENT_HISTORY_BODY_MAX)
      return jsonErr("VALIDATION_ERROR", "Registro longo demais.", 400);
    const existing = await prisma.enrollmentHistoryEntry.findUnique({
      where: { id: requestId! },
      select: {
        id: true,
        enrollmentId: true,
        authorId: true,
        kind: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
    if (existing) {
      if (
        existing.enrollmentId !== enrollmentId ||
        existing.authorId !== user.id ||
        existing.body !== recordBody
      )
        return jsonErr("CONFLICT", "Identificador de registro já utilizado.", 409);
      return jsonOk({
        entry: {
          id: existing.id,
          kind: existing.kind,
          body: existing.body,
          createdAt: existing.createdAt.toISOString(),
          authorName: existing.author.name,
        },
      });
    }
  }

  let created;
  try {
    if (structured) {
      const teacherId = "teacherId" in owned ? owned.teacherId : null;
      if (!teacherId) return jsonErr("FORBIDDEN", "Professor não autorizado.", 403);
      created = await prisma.$transaction(async (tx) => {
        // A trava mantém matrícula e aluno estáveis até a gravação do histórico.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT e.id FROM "Enrollment" e
          JOIN "Student" s ON s.id = e."studentId"
          WHERE e.id = ${enrollmentId} AND e."classGroupId" = ${classGroupId}
          FOR UPDATE OF e, s
        `;
        if (locked.length === 0) return null;
        const activeTeacher = await tx.teacher.findFirst({
          where: { id: teacherId, userId: user.id, deletedAt: null },
          select: { id: true },
        });
        if (!activeTeacher) return null;
        const current = await tx.enrollment.findFirst({
          where: {
            id: enrollmentId,
            classGroupId,
            status: "ACTIVE",
            isPreEnrollment: false,
            student: { deletedAt: null },
            classGroup: classGroupTeacherAccessWhere(teacherId),
          },
          select: { id: true },
        });
        if (!current) return null;
        return tx.enrollmentHistoryEntry.create({
          data: {
            id: requestId!,
            enrollmentId,
            authorId: user.id,
            kind: "BUSCA_ATIVA",
            body: recordBody,
          },
          select: {
            id: true,
            kind: true,
            body: true,
            createdAt: true,
            author: { select: { name: true } },
          },
        });
      });
      if (!created)
        return jsonErr(
          "STALE_CONTEXT",
          "A matrícula não está mais elegível. Atualize a turma.",
          409,
        );
    } else {
      created = await prisma.enrollmentHistoryEntry.create({
        data: { enrollmentId, authorId: user.id, kind: "BUSCA_ATIVA", body: recordBody },
        select: {
          id: true,
          kind: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      });
    }
  } catch (error) {
    if (
      !requestId ||
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2002"
    )
      throw error;
    const previous = await prisma.enrollmentHistoryEntry.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        enrollmentId: true,
        authorId: true,
        kind: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
    if (
      !previous ||
      previous.enrollmentId !== enrollmentId ||
      previous.authorId !== user.id ||
      previous.body !== recordBody
    )
      return jsonErr("CONFLICT", "Identificador de registro já utilizado.", 409);
    return jsonOk({
      entry: {
        id: previous.id,
        kind: previous.kind,
        body: previous.body,
        createdAt: previous.createdAt.toISOString(),
        authorName: previous.author.name,
      },
    });
  }

  try {
    await notifyEnrollmentHistoryEntry(created.id);
  } catch (error) {
    console.error("[enrollment-history] notificação", error);
  }

  return jsonOk(
    {
      entry: {
        id: created.id,
        kind: created.kind,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        authorName: created.author.name,
      },
    },
    { status: 201 },
  );
}
