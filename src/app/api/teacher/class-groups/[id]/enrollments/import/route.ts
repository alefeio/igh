import { randomUUID } from "node:crypto";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { CLASS_GROUP_OPERATIONAL_ENROLLABLE } from "@/lib/class-group-scope";
import { hashPassword } from "@/lib/auth";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";
import { birthDateToStudentPasswordParts } from "@/lib/student-password";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  buildTeacherEnrollmentImportTemplateBuffer,
  parseTeacherEnrollmentImportFile,
  type TeacherEnrollmentImportRow,
} from "@/lib/teacher-enrollment-import";

export const runtime = "nodejs";

async function resolveTeacherClassGroup(classGroupId: string) {
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
    },
  });
  if (!cg) {
    return { error: jsonErr("NOT_FOUND", "Turma não encontrada.", 404) as Response };
  }
  return { user, teacher, cg };
}

/** Download do modelo de planilha. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: classGroupId } = await context.params;
  const resolved = await resolveTeacherClassGroup(classGroupId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const buffer = await buildTeacherEnrollmentImportTemplateBuffer();
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-alunos.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

async function findExistingStudent(row: TeacherEnrollmentImportRow): Promise<string | null> {
  if (row.email) {
    const byEmail = await prisma.student.findFirst({
      where: { email: row.email, deletedAt: null },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
    const user = await prisma.user.findUnique({
      where: { email: row.email },
      select: { id: true },
    });
    if (user) {
      const linked = await prisma.student.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (linked) return linked.id;
    }
  }
  if (row.cpf && row.cpf.length === 11) {
    const byCpf = await prisma.student.findFirst({
      where: { cpf: row.cpf, deletedAt: null },
      select: { id: true },
    });
    if (byCpf) return byCpf.id;
  }
  return null;
}

async function createStudentFromRow(row: TeacherEnrollmentImportRow): Promise<string> {
  const birthDate = new Date(`${row.birthDate}T00:00:00.000Z`);
  const cpfNormalized = row.cpf && row.cpf.length === 11 ? row.cpf : `MENOR-${randomUUID()}`;
  let userId: string | null = null;

  if (row.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: row.email },
      select: { id: true },
    });
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { password } = birthDateToStudentPasswordParts(birthDate);
      const passwordHash = await hashPassword(password);
      const created = await prisma.user.create({
        data: {
          name: row.name.trim(),
          email: row.email,
          passwordHash,
          role: "STUDENT",
          isActive: true,
          mustChangePassword: true,
          birthDate,
          whatsapp: row.phone || null,
        },
        select: { id: true },
      });
      userId = created.id;
    }
  }

  const student = await prisma.student.create({
    data: {
      name: row.name.trim(),
      birthDate,
      cpf: cpfNormalized,
      phone: row.phone,
      email: row.email,
      userId,
      rg: "",
      gender: "PREFER_NOT_SAY",
      educationLevel: "OTHER",
      guardianName: row.guardianName,
      guardianCpf: row.guardianCpf,
      guardianPhone: row.guardianPhone,
      guardianRelationship: row.guardianRelationship,
      guardianRg: row.guardianRg,
    },
    select: { id: true },
  });
  return student.id;
}

/** Importa planilha → pré-matrículas (ACTIVE + isPreEnrollment). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: classGroupId } = await context.params;
  const resolved = await resolveTeacherClassGroup(classGroupId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { cg } = resolved;

  if (!(CLASS_GROUP_OPERATIONAL_ENROLLABLE as readonly string[]).includes(cg.status)) {
    return jsonErr(
      "VALIDATION_ERROR",
      "Esta turma não está aceitando matrículas no momento.",
      400,
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonErr("VALIDATION_ERROR", "Envie o arquivo da planilha.", 400);

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonErr("VALIDATION_ERROR", "Selecione um arquivo .xlsx ou .csv.", 400);
  }
  const fileName = file.name || "alunos.xlsx";
  if (!/\.(xlsx|csv)$/i.test(fileName)) {
    return jsonErr("VALIDATION_ERROR", "Formato inválido. Use .xlsx ou .csv.", 400);
  }
  if (file.size > 8 * 1024 * 1024) {
    return jsonErr("VALIDATION_ERROR", "Arquivo muito grande (máx. 8 MB).", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseTeacherEnrollmentImportFile(buffer, fileName);
  } catch (e) {
    console.error("[teacher/enrollments/import]", e);
    return jsonErr("VALIDATION_ERROR", "Não foi possível ler a planilha.", 400);
  }

  const errors = [...parsed.errors];
  let createdStudents = 0;
  let enrolled = 0;
  let skippedExistingEmail = 0;
  let classFull = false;

  let occupied = await prisma.enrollment.count({
    where: { classGroupId: cg.id, status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } },
  });

  for (const row of parsed.rows) {
    if (classFull || occupied >= cg.capacity) {
      classFull = true;
      errors.push({ row: row.rowNumber, message: "Turma lotada — linha não importada." });
      continue;
    }

    try {
      let studentId = await findExistingStudent(row);
      const wasExisting = Boolean(studentId);

      if (!studentId) {
        studentId = await createStudentFromRow(row);
        createdStudents += 1;
      } else if (row.email) {
        skippedExistingEmail += 1;
      }

      const existingEnrollment = await prisma.enrollment.findFirst({
        where: {
          studentId,
          classGroupId: cg.id,
          status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] },
        },
        select: { id: true },
      });
      if (existingEnrollment) {
        errors.push({
          row: row.rowNumber,
          message: wasExisting
            ? "Aluno já matriculado nesta turma."
            : "Aluno criado, mas já havia matrícula ativa nesta turma.",
        });
        continue;
      }

      occupied = await prisma.enrollment.count({
        where: { classGroupId: cg.id, status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } },
      });
      if (occupied >= cg.capacity) {
        classFull = true;
        errors.push({ row: row.rowNumber, message: "Turma lotada — linha não importada." });
        continue;
      }

      await prisma.enrollment.create({
        data: {
          studentId,
          classGroupId: cg.id,
          status: "ACTIVE",
          isPreEnrollment: true,
        },
      });
      occupied += 1;
      enrolled += 1;
    } catch (e) {
      console.error("[teacher/enrollments/import] row", row.rowNumber, e);
      errors.push({
        row: row.rowNumber,
        message: e instanceof Error ? e.message : "Erro ao processar a linha.",
      });
    }
  }

  return jsonOk({
    createdStudents,
    enrolled,
    skippedExistingEmail,
    errors,
  });
}
