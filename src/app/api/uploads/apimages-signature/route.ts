import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getApimagesConfig } from "@/lib/apimages";
import { z } from "zod";
import { resolveTeacherIdForUser, teacherOwnsEnrollment } from "@/lib/class-group-teachers";
import { poloCoordinatorOwnsEnrollment } from "@/lib/polo-coordinator-scope";
import { staffCanAccessStudent } from "@/lib/student-staff-scope";

const bodySchema = z
  .object({
    studentId: z.string().min(1).optional(),
    enrollmentId: z.string().uuid().optional(),
    attachmentType: z.enum(["ID_DOCUMENT", "ADDRESS_PROOF"]).optional(),
  })
  .refine((d) => (d.studentId != null) !== (d.enrollmentId != null), {
    message: "Informe studentId ou enrollmentId (apenas um).",
  });

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER", "POLO_COORDINATOR"]);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { studentId, enrollmentId } = parsed.data;

  if (enrollmentId) {
    if (user.role === "TEACHER") {
      const teacherId = await resolveTeacherIdForUser(user.id);
      if (!teacherId || !(await teacherOwnsEnrollment(teacherId, enrollmentId))) {
        return jsonErr("FORBIDDEN", "Acesso negado.", 403);
      }
    } else if (user.role === "POLO_COORDINATOR") {
      if (!(await poloCoordinatorOwnsEnrollment(user.id, enrollmentId))) {
        return jsonErr("FORBIDDEN", "Acesso negado.", 403);
      }
    }
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true },
    });
    if (!enrollment) {
      return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
    }
    try {
      const { apiKey, uploadUrl } = getApimagesConfig();
      return jsonOk({ uploadUrl, apiKey });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
      return jsonErr("CONFIG_ERROR", message, 500);
    }
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId! },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }
  if (!(await staffCanAccessStudent(user, student.id))) {
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  try {
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
