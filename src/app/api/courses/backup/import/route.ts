import { createAuditLog } from "@/lib/audit";
import { requireStaffWrite } from "@/lib/auth";
import {
  COURSE_BACKUP_FORMAT,
  importCoursesBackup,
  parseCourseBackupPayload,
  type CourseBackupPayload,
} from "@/lib/course-backup";
import { jsonErr, jsonOk } from "@/lib/http";

export const maxDuration = 300;

/** Importa backup JSON de cursos (upsert por ID). */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch {
    return jsonErr("FORBIDDEN", "Sem permissão para importar cursos.", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonErr("VALIDATION_ERROR", "Envie o JSON do backup de cursos.", 400);
  }

  // Aceita o arquivo inteiro ou `{ backup: { ... } }`
  const raw =
    "backup" in body && (body as { backup?: unknown }).backup
      ? (body as { backup: unknown }).backup
      : body;

  let payload: CourseBackupPayload;
  try {
    payload = parseCourseBackupPayload(raw);
  } catch (e) {
    return jsonErr(
      "VALIDATION_ERROR",
      e instanceof Error ? e.message : `Formato inválido (esperado ${COURSE_BACKUP_FORMAT}).`,
      400,
    );
  }

  try {
    const result = await importCoursesBackup(payload);
    await createAuditLog({
      entityType: "Course",
      entityId: result.courseIds[0] ?? "course-backup-import",
      action: "COURSE_BACKUP_IMPORT",
      diff: {
        imported: result.imported,
        created: result.created,
        updated: result.updated,
        courseIds: result.courseIds,
      },
      performedByUserId: user.id,
    });
    return jsonOk({
      message: `Importados ${result.imported} curso(s): ${result.created} novo(s), ${result.updated} atualizado(s).`,
      ...result,
    });
  } catch (e) {
    console.error("[courses/backup/import]", e);
    const msg = e instanceof Error ? e.message : "Falha ao importar cursos.";
    const fkHint =
      /foreign key|Foreign key|P2003|P2014/i.test(msg)
        ? " Há vínculos (turmas/progresso) que impedem substituir o conteúdo. Remova turmas relacionadas ou importe em ambiente limpo."
        : "";
    return jsonErr("IMPORT_ERROR", msg + fkHint, 500);
  }
}
