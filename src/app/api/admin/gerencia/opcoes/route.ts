import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { birthDateToInputValue } from "@/lib/validators/person-contact";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/**
 * Contas e polos oferecidos nos formulários da gerência.
 * Alunos ficam de fora.
 * - padrão: só quem ainda não tem ficha de colaborador (para vincular).
 * - `?allStaff=true`: toda a equipe ativa (ex.: responsável financeiro).
 * - `?includeUserId=`: mantém o usuário já vinculado ao editar colaborador.
 */
export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const includeUserId = searchParams.get("includeUserId");
  const allStaff = searchParams.get("allStaff") === "true";

  const [users, polos] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: "STUDENT" },
        ...(allStaff
          ? {}
          : {
              OR: [{ employee: null }, ...(includeUserId ? [{ id: includeUserId }] : [])],
            }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        whatsapp: true,
        birthDate: true,
        teacher: {
          select: { phone: true, email: true, deletedAt: true },
        },
        student: {
          select: {
            cpf: true,
            rg: true,
            phone: true,
            email: true,
            birthDate: true,
            cep: true,
            street: true,
            number: true,
            complement: true,
            neighborhood: true,
            city: true,
            state: true,
            deletedAt: true,
          },
        },
      },
    }),
    prisma.polo.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return jsonOk({
    users: users.map((u) => {
      const teacher = u.teacher && !u.teacher.deletedAt ? u.teacher : null;
      const student = u.student && !u.student.deletedAt ? u.student : null;
      const phone =
        u.whatsapp?.replace(/\D/g, "") ||
        teacher?.phone?.replace(/\D/g, "") ||
        student?.phone?.replace(/\D/g, "") ||
        null;
      const birthDate =
        birthDateToInputValue(u.birthDate) || birthDateToInputValue(student?.birthDate) || null;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        phone,
        birthDate,
        cpf: student?.cpf ?? null,
        rg: student?.rg ?? null,
        emailAlt: teacher?.email || student?.email || null,
        cep: student?.cep ?? null,
        street: student?.street ?? null,
        number: student?.number ?? null,
        complement: student?.complement ?? null,
        neighborhood: student?.neighborhood ?? null,
        city: student?.city ?? null,
        state: student?.state ?? null,
      };
    }),
    polos,
  });
}
