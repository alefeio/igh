import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id: classGroupId, materialId } = await context.params;
    const access = await requireTeacherClassGroup(classGroupId);
    if ("error" in access) return access.error;

    const existing = await prisma.classGroupTeacherMaterial.findFirst({
      where: { id: materialId, classGroupId },
      select: { id: true },
    });
    if (!existing) return jsonErr("NOT_FOUND", "Material não encontrado.", 404);

    await prisma.classGroupTeacherMaterial.delete({ where: { id: existing.id } });
    return jsonOk({ id: existing.id });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível remover o material.", 500);
  }
}
