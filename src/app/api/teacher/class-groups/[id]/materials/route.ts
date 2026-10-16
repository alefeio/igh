import { z } from "zod";

import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertResolvedPublicHttps } from "@/lib/teacher-class-material-fetch";
import {
  MaterialUrlError,
  MAX_TEACHER_MATERIAL_BYTES,
  isViewerTeacherMaterial,
  sanitizeMaterialFileName,
  teacherMaterialClassLabel,
  teacherMaterialLessonLabel,
  toTeacherMaterialDto,
  type TeacherMaterialDto,
} from "@/lib/teacher-class-material";
import { requireReadableClassGroup, requireTeacherClassGroup } from "@/lib/teacher-class-group-access";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  url: z.string().trim().min(8).max(4000),
  fileName: z.string().trim().min(1).max(180),
  publicId: z.string().trim().max(300).optional(),
  mimeType: z.string().trim().max(150).optional(),
  sizeBytes: z.number().int().nonnegative().max(MAX_TEACHER_MATERIAL_BYTES).optional(),
  lessonId: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().uuid().nullable().optional(),
  ),
});

const materialSelect = {
  id: true,
  classGroupId: true,
  fileName: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedByUserId: true,
  uploadedByUser: { select: { name: true } },
  lesson: {
    select: {
      title: true,
      module: { select: { title: true } },
    },
  },
  classGroup: {
    select: {
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      teacher: { select: { name: true, userId: true } },
    },
  },
} as const;

function mapMaterial(
  row: {
    id: string;
    classGroupId: string;
    fileName: string;
    url: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: Date;
    uploadedByUser: { name: string } | null;
    lesson: { title: string; module: { title: string } } | null;
    classGroup: {
      daysOfWeek: string[];
      startTime: string;
      endTime: string;
      teacher: { name: string; userId: string | null };
    };
  },
  currentClassGroupId: string,
): TeacherMaterialDto {
  return toTeacherMaterialDto(row, {
    ownerName: row.uploadedByUser?.name?.trim() || row.classGroup.teacher.name,
    classLabel: teacherMaterialClassLabel(row.classGroup),
    fromThisClass: row.classGroupId === currentClassGroupId,
    lessonLabel: teacherMaterialLessonLabel(
      row.lesson ? { moduleTitle: row.lesson.module.title, lessonTitle: row.lesson.title } : null,
    ),
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: classGroupId } = await context.params;
    const access = await requireReadableClassGroup(classGroupId);
    if ("error" in access) return access.error;

    const courseId = access.classGroup.courseId;
    const viewerUserId = access.teacher ? access.user.id : null;
    const [rows, lessonRows] = await Promise.all([
      prisma.classGroupTeacherMaterial.findMany({
        where: { classGroup: { courseId } },
        orderBy: { createdAt: "desc" },
        select: materialSelect,
      }),
      prisma.courseLesson.findMany({
        where: { module: { courseId } },
        orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
        select: { id: true, title: true, module: { select: { title: true } } },
      }),
    ]);
    const ownRows = rows.filter((row) =>
      isViewerTeacherMaterial({
        uploadedByUserId: row.uploadedByUserId,
        classGroupId: row.classGroupId,
        currentClassGroupId: classGroupId,
        viewerUserId,
        primaryTeacherUserId: row.classGroup.teacher.userId,
      }),
    );
    const colleagueRows = rows.filter((row) => !ownRows.includes(row));

    const colleagues = colleagueRows
      .map((row) => mapMaterial(row, classGroupId))
      .sort(
        (a, b) =>
          a.ownerName.localeCompare(b.ownerName, "pt-BR") || b.createdAt.localeCompare(a.createdAt)
      );
    const materials = ownRows
      .map((row) => mapMaterial(row, classGroupId))
      .sort(
        (a, b) =>
          Number(b.fromThisClass) - Number(a.fromThisClass) || b.createdAt.localeCompare(a.createdAt)
      );

    return jsonOk({
      materials,
      colleagues,
      lessons: lessonRows.map((lesson) => ({
        id: lesson.id,
        label: teacherMaterialLessonLabel({ moduleTitle: lesson.module.title, lessonTitle: lesson.title }),
      })),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar os materiais.", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: classGroupId } = await context.params;
    const access = await requireTeacherClassGroup(classGroupId);
    if ("error" in access) return access.error;

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    let url: string;
    try {
      url = await assertResolvedPublicHttps(parsed.data.url);
    } catch (e) {
      const message = e instanceof MaterialUrlError ? e.message : "Endereço do arquivo inválido.";
      return jsonErr("VALIDATION_ERROR", message, 400);
    }

    const lessonId = parsed.data.lessonId ?? null;
    if (lessonId) {
      const lesson = await prisma.courseLesson.findFirst({
        where: { id: lessonId, module: { courseId: access.classGroup.courseId } },
        select: { id: true },
      });
      if (!lesson) return jsonErr("VALIDATION_ERROR", "Aula não encontrada neste curso.", 400);
    }

    const created = await prisma.classGroupTeacherMaterial.create({
      data: {
        classGroupId,
        fileName: sanitizeMaterialFileName(parsed.data.fileName),
        url,
        publicId: parsed.data.publicId || null,
        mimeType: parsed.data.mimeType || null,
        sizeBytes: parsed.data.sizeBytes ?? null,
        uploadedByUserId: access.user.id,
        lessonId,
      },
      select: materialSelect,
    });

    return jsonOk({ material: mapMaterial(created, classGroupId) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível salvar o material.", 500);
  }
}
