import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Histórico de páginas vistas na área logada (apenas Master). */
export async function GET(request: Request) {
  try {
    await requireRole("MASTER");
  } catch {
    return jsonErr("FORBIDDEN", "Apenas o perfil Master pode consultar este relatório.", 403);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE)
  );
  const skip = (page - 1) * pageSize;
  const userIdFilter = searchParams.get("userId")?.trim() || undefined;

  const where = userIdFilter ? { userId: userIdFilter } : {};

  const [total, rows, usersWithActivity] = await Promise.all([
    prisma.userPageVisit.count({ where }),
    prisma.userPageVisit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        path: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { pageVisits: { some: {} } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 400,
    }),
  ]);

  return jsonOk({
    total,
    page,
    pageSize,
    usersWithActivity,
    items: rows.map((r) => ({
      id: r.id,
      path: r.path,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
  });
}
