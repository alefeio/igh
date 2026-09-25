import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { buildCertificateSignoffListPdf } from "@/lib/certificate-signoff-list-pdf";
import { slugPart } from "@/lib/course-certificates-zip";
import { classGroupCertificateEnrollmentWhere } from "@/lib/certificate-zip-enrollment";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

/** URL da logo salva em /admin/site/configuracoes (SiteSettings.logoUrl). */
function absoluteSiteLogoUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

async function downloadSiteLogoBytes(): Promise<Uint8Array> {
  const settings = await prisma.siteSettings.findFirst({ select: { logoUrl: true } });
  const url = absoluteSiteLogoUrl(settings?.logoUrl);
  if (!url) {
    throw new Error("A URL da logomarca não está definida em Configurações do site.");
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error("Não foi possível baixar a logomarca configurada no site.");
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** PDF de assinatura dos alunos habilitados ao certificado da turma. */
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["ADMIN", "MASTER", "TEACHER"]);
    const { id: classGroupId } = await ctx.params;

    const classGroupSelect = {
      location: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      course: { select: { name: true } },
      cycle: { select: { cycle: true, year: true } },
    } as const;

    const classGroup =
      user.role === "TEACHER"
        ? await (async () => {
            const teacher = await prisma.teacher.findFirst({
              where: { userId: user.id, deletedAt: null },
              select: { id: true },
            });
            if (!teacher) return null;
            return prisma.classGroup.findFirst({
              where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
              select: classGroupSelect,
            });
          })()
        : await prisma.classGroup.findFirst({
            where: { id: classGroupId },
            select: classGroupSelect,
          });

    if (!classGroup) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

    const enrollments = await prisma.enrollment.findMany({
      where: classGroupCertificateEnrollmentWhere(classGroupId),
      select: { student: { select: { name: true } } },
    });

    if (enrollments.length === 0) {
      return jsonErr("VALIDATION_ERROR", "Não há alunos habilitados para certificado nesta turma.", 400);
    }

    const pdf = await buildCertificateSignoffListPdf({
      group: {
        courseName: classGroup.course.name,
        cycle: classGroup.cycle.cycle,
        year: classGroup.cycle.year,
        location: classGroup.location,
        daysOfWeek: classGroup.daysOfWeek,
        startTime: classGroup.startTime,
        endTime: classGroup.endTime,
      },
      students: enrollments.map((row) => ({ name: row.student.name })),
      logoBytes: await downloadSiteLogoBytes(),
    });

    const fileName = `listagem-certificados-${slugPart(classGroup.course.name)}-c${classGroup.cycle.cycle}-${classGroup.cycle.year}.pdf`;

    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Falha ao gerar a listagem.";
    return jsonErr("INTERNAL_ERROR", msg, 500);
  }
}
