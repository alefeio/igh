import { z } from "zod";

import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertResolvedPublicHttps } from "@/lib/teacher-class-material-fetch";
import {
  MaterialUrlError,
  MAX_TEACHER_MATERIAL_BYTES,
  sanitizeMaterialFileName,
  toTeacherMaterialDto,
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

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: classGroupId } = await context.params;
    const access = await requireReadableClassGroup(classGroupId);
    if ("error" in access) return access.error;

    const rows = await prisma.classGroupTeacherMaterial.findMany({
      where: { classGroupId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        url: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    return jsonOk({ materials: rows.map(toTeacherMaterialDto) });
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
      select: {
        id: true,
        fileName: true,
        url: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    return jsonOk({ material: toTeacherMaterialDto(created) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível salvar o material.", 500);
  }
}
