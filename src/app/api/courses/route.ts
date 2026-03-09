import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createCourseSchema } from "@/lib/validators/courses";
import { createAuditLog } from "@/lib/audit";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  return (async () => {
    let slug = base;
    let n = 0;
    for (;;) {
      const existing = await prisma.course.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing || (excludeId && existing.id === excludeId)) return slug;
      slug = `${base}-${++n}`;
    }
  })();
}

export async function GET() {
  const user = await requireRole(["MASTER", "ADMIN", "TEACHER"]);

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);
    }
    const classGroups = await prisma.classGroup.findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true },
    });
    const courseIds = [...new Set(classGroups.map((cg) => cg.courseId))];
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      orderBy: { name: "asc" },
    });
    return jsonOk({ courses });
  }

  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
  });

  return jsonOk({ courses });
}

export async function POST(request: Request) {
  const user = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { name, description, content, imageUrl, workloadHours, status, slug: slugInput } = parsed.data;
  const existing = await prisma.course.findUnique({ where: { name }, select: { id: true } });
  if (existing) {
    return jsonErr("DUPLICATE_NAME", "Já existe um curso com este nome.", 409);
  }

  const baseSlug = slugInput || slugify(name);
  const slug = await ensureUniqueSlug(baseSlug);

  const course = await prisma.course.create({
    data: {
      name,
      slug,
      description: description || null,
      content: content || null,
      imageUrl: imageUrl || null,
      workloadHours: workloadHours ?? null,
      status: status ?? "ACTIVE",
    },
  });

  await createAuditLog({
    entityType: "Course",
    entityId: course.id,
    action: "CREATE",
    diff: { after: course },
    performedByUserId: user.id,
  });

  return jsonOk({ course }, { status: 201 });
}
