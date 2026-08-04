import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

/**
 * Usuários do painel (/users) ainda sem perfil de professor —
 * para vincular no modal «Novo professor».
 */
export async function GET() {
  await requireRole(["MASTER", "ADMIN"]);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      teacher: null,
      OR: [
        { role: "GENERAL_ADMIN" },
        { role: "ADMIN" },
        { role: "SITE_ADMIN" },
        { role: "POLO_COORDINATOR" },
        { role: "MASTER" },
        { isAdmin: true },
        { isSiteAdmin: true },
        { isPoloCoordinator: true },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      whatsapp: true,
      birthDate: true,
    },
  });

  return jsonOk({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.whatsapp,
      birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null,
    })),
  });
}
