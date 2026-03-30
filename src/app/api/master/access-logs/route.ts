import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Histórico de logins (apenas perfil Master na sessão). */
export async function GET(request: Request) {
  try {
    await requireRole("MASTER");
  } catch {
    return jsonErr("FORBIDDEN", "Apenas o perfil Master pode consultar os acessos.", 403);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE)
  );
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.userAccessLog.count(),
    prisma.userAccessLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
        loginKind: true,
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
  ]);

  return jsonOk({
    total,
    page,
    pageSize,
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      loginKind: r.loginKind,
      user: {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        role: r.user.role,
        isActive: r.user.isActive,
      },
    })),
  });
}
