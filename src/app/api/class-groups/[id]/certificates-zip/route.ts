import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import {
  buildClassGroupCertificatesZip,
  parseCertificateZipPages,
  slugPart,
  zipResponse,
} from "@/lib/course-certificates-zip";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * ZIP com certificados dos alunos aptos (certificateEligible) da turma.
 * Query: pages=front | both (padrão both).
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR", "TEACHER"]);
    const { id: classGroupId } = await ctx.params;
    const pages = parseCertificateZipPages(new URL(request.url).searchParams.get("pages"));

    const classGroupSelect = {
      id: true,
      status: true,
      course: { select: { name: true } },
      cycle: { select: { cycle: true, year: true } },
    } as const;

    let classGroup: {
      id: string;
      status: string;
      course: { name: string };
      cycle: { cycle: number; year: number };
    } | null = null;

    if (user.role === "TEACHER") {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!teacher) return jsonErr("FORBIDDEN", "Professor não encontrado.", 403);
      classGroup = await prisma.classGroup.findFirst({
        where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
        select: classGroupSelect,
      });
    } else {
      classGroup = await prisma.classGroup.findFirst({
        where: { id: classGroupId },
        select: classGroupSelect,
      });
    }

    if (!classGroup) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

    const { zipBytes, errors, fileCount } = await buildClassGroupCertificatesZip(classGroupId, pages);

    if (fileCount === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        errors.length
          ? `Nenhum certificado gerado. ${errors.slice(0, 3).join("; ")}`
          : "Não há alunos aptos a certificado nesta turma.",
        400,
      );
    }

    const courseSlug = slugPart(classGroup.course.name);
    const cycleLabel = `${classGroup.cycle.cycle}-${classGroup.cycle.year}`;
    const zipName = `certificados-${courseSlug}-${cycleLabel}.zip`;

    return zipResponse(zipBytes, zipName, errors);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao montar o ZIP.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
