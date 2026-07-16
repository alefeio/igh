import JSZip from "jszip";

import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { ensureEnrollmentCertificate } from "@/lib/ensure-enrollment-certificate";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

function slugPart(value: string): string {
  return (value || "turma")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

/**
 * ZIP com certificados de todos os alunos ativos/concluídos da turma.
 * Acesso: staff (ADMIN/MASTER/COORDINATOR) ou professor da turma.
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR", "TEACHER"]);
    const { id: classGroupId } = await ctx.params;

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

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classGroupId,
        status: { in: ["ACTIVE", "COMPLETED", "SUSPENDED"] },
        isPreEnrollment: false,
        certificateEligible: true,
      },
      select: { id: true, student: { select: { name: true } } },
      orderBy: { student: { name: "asc" } },
    });

    if (enrollments.length === 0) {
      return jsonErr(
        "VALIDATION_ERROR",
        "Não há alunos aptos a certificado nesta turma (flag de certificado ou 70% de presença).",
        400,
      );
    }

    const zip = new JSZip();
    const errors: string[] = [];

    for (const row of enrollments) {
      try {
        const ensured = await ensureEnrollmentCertificate(row.id, { force: true });
        zip.file(ensured.fileName, ensured.pdfBytes);
      } catch (e) {
        const name = row.student.name || row.id;
        errors.push(`${name}: ${e instanceof Error ? e.message : "falha"}`);
      }
    }

    const files = Object.keys(zip.files).filter((k) => !zip.files[k]?.dir);
    if (files.length === 0) {
      return jsonErr(
        "INTERNAL_ERROR",
        errors.length
          ? `Nenhum certificado gerado. ${errors.slice(0, 3).join("; ")}`
          : "Nenhum certificado gerado.",
        500,
      );
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const courseSlug = slugPart(classGroup.course.name);
    const cycleLabel = `${classGroup.cycle.cycle}-${classGroup.cycle.year}`;
    const zipName = `certificados-${courseSlug}-${cycleLabel}.zip`;

    return new Response(Buffer.from(zipBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Cache-Control": "private, no-store",
        ...(errors.length ? { "X-Certificate-Errors": String(errors.length) } : {}),
      },
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao montar o ZIP.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
