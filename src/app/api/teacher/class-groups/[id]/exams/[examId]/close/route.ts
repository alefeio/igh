import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ id: string; examId: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId, examId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const exam = await prisma.classGroupExam.findFirst({ where: { id: examId, classGroupId } });
  if (!exam) return jsonErr("NOT_FOUND", "Prova não encontrada.", 404);

  await prisma.classGroupExam.update({
    where: { id: examId },
    data: { status: "CLOSED" },
  });

  return jsonOk({ id: examId, status: "CLOSED" });
}
