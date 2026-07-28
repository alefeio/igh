import { z } from "zod";

import { createAuditLog } from "@/lib/audit";
import { requireStaffWrite } from "@/lib/auth";
import { exportCoursesBackup } from "@/lib/course-backup";
import { jsonErr, jsonOk } from "@/lib/http";

export const maxDuration = 120;

const bodySchema = z.object({
  courseIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um curso."),
});

/** Exporta backup JSON dos cursos selecionados (conteúdo pedagógico). */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch {
    return jsonErr("FORBIDDEN", "Sem permissão para exportar cursos.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const backup = await exportCoursesBackup(parsed.data.courseIds);
    await createAuditLog({
      entityType: "Course",
      entityId: parsed.data.courseIds[0] ?? "course-backup-export",
      action: "COURSE_BACKUP_EXPORT",
      diff: {
        courseIds: parsed.data.courseIds,
        exportedCount: backup.courses.length,
      },
      performedByUserId: user.id,
    });
    return jsonOk({ backup });
  } catch (e) {
    console.error("[courses/backup/export]", e);
    return jsonErr(
      "EXPORT_ERROR",
      e instanceof Error ? e.message : "Falha ao exportar cursos.",
      500,
    );
  }
}
