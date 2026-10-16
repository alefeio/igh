import { z } from "zod";

import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertResolvedPublicHttps } from "@/lib/teacher-class-material-fetch";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import {
  MaterialUrlError,
  MAX_TEACHER_MATERIAL_BYTES,
  sanitizeMaterialFileName,
  teacherMaterialClassLabel,
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
});

const materialSelect = {
  id: true,
  classGroupId: true,
  fileName: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedByUser: { select: { name: true } },
  classGroup: {
    select: {
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      teacher: { select: { name: true } },
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
    classGroup: {
      daysOfWeek: string[];
      startTime: string;
      endTime: string;
      teacher: { name: string };
    };
  },
  currentClassGroupId: string,
): TeacherMaterialDto {
  return toTeacherMaterialDto(row, {
    ownerName: row.uploadedByUser?.name?.trim() || row.classGroup.teacher.name,
    classLabel: teacherMaterialClassLabel(row.classGroup),
    fromThisClass: row.classGroupId === currentClassGroupId,
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: classGroupId } = await context.params;
    const access = await requireReadableClassGroup(classGroupId);
    if ("error" in access) return access.error;

    const courseId = access.classGroup.courseId;
    const ownClassGroups = access.teacher
      ? { courseId, ...classGroupTeacherAccessWhere(access.teacher.id) }
      : { id: classGroupId };
    const colleagueClassGroups = access.teacher
      ? {
          courseId,
          id: { not: classGroupId },
          NOT: classGroupTeacherAccessWhere(access.teacher.id),
        }
      : {
          courseId,
          id: { not: classGroupId },
        };

    const [ownRows, colleagueRows] = await Promise.all([
      prisma.classGroupTeacherMaterial.findMany({
        where: { classGroup: ownClassGroups },
        orderBy: { createdAt: "desc" },
        select: materialSelect,
      }),
      prisma.classGroupTeacherMaterial.findMany({
        where: { classGroup: colleagueClassGroups },
        orderBy: { createdAt: "desc" },
        select: materialSelect,
      }),
    ]);

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

    return jsonOk({ materials, colleagues });
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

    const created = await prisma.classGroupTeacherMaterial.create({
      data: {
        classGroupId,
        fileName: sanitizeMaterialFileName(parsed.data.fileName),
        url,
        publicId: parsed.data.publicId || null,
        mimeType: parsed.data.mimeType || null,
        sizeBytes: parsed.data.sizeBytes ?? null,
        uploadedByUserId: access.user.id,
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
