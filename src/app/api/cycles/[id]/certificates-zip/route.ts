import JSZip from "jszip";

import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { ensureEnrollmentCertificate } from "@/lib/ensure-enrollment-certificate";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

function slugPart(value: string): string {
  return (value || "ciclo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

/**
 * ZIP com certificados de todas as turmas do ciclo.
 * Acesso: staff (ADMIN/MASTER/COORDINATOR).
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
    const { id: cycleId } = await ctx.params;

    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, cycle: true, year: true },
    });
    if (!cycle) return jsonErr("NOT_FOUND", "Ciclo não encontrado.", 404);

    const classGroups = await prisma.classGroup.findMany({
      where: { cycleId, status: { not: "CANCELADA" } },
      select: {
        id: true,
        course: { select: { name: true } },
      },
      orderBy: [{ course: { name: "asc" } }, { startDate: "asc" }],
    });

    if (classGroups.length === 0) {
      return jsonErr("VALIDATION_ERROR", "Não há turmas neste ciclo.", 400);
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classGroupId: { in: classGroups.map((cg) => cg.id) },
        status: { in: ["ACTIVE", "COMPLETED", "SUSPENDED"] },
        isPreEnrollment: false,
      },
      select: {
        id: true,
        classGroupId: true,
        student: { select: { name: true } },
        classGroup: { select: { course: { select: { name: true } } } },
      },
      orderBy: [{ classGroup: { course: { name: "asc" } } }, { student: { name: "asc" } }],
    });

    if (enrollments.length === 0) {
      return jsonErr("VALIDATION_ERROR", "Não há alunos matriculados nas turmas deste ciclo.", 400);
    }

    const zip = new JSZip();
    const errors: string[] = [];
    const courseByClassGroup = new Map(classGroups.map((cg) => [cg.id, slugPart(cg.course.name)]));

    for (const row of enrollments) {
      try {
        const ensured = await ensureEnrollmentCertificate(row.id, { force: true });
        const folder = courseByClassGroup.get(row.classGroupId) || "turma";
        zip.file(`${folder}/${ensured.fileName}`, ensured.pdfBytes);
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
    const zipName = `certificados-ciclo-${cycle.cycle}-${cycle.year}.zip`;

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
    const msg = e instanceof Error ? e.message : "Falha ao montar o ZIP do ciclo.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
