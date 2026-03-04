import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Retorna o perfil completo do aluno (para a página Meus dados). Apenas STUDENT, próprio cadastro. */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Cadastro de aluno não encontrado.", 404);
  }

  return jsonOk({
    student: {
      id: student.id,
      name: student.name,
      birthDate: student.birthDate,
      cpf: student.cpf,
      rg: student.rg,
      email: student.email,
      phone: student.phone,
      cep: student.cep,
      street: student.street,
      number: student.number,
      complement: student.complement,
      neighborhood: student.neighborhood,
      city: student.city,
      state: student.state,
      gender: student.gender,
      hasDisability: student.hasDisability,
      disabilityDescription: student.disabilityDescription,
      educationLevel: student.educationLevel,
      isStudying: student.isStudying,
      studyShift: student.studyShift,
      guardianName: student.guardianName,
      guardianCpf: student.guardianCpf,
      guardianRg: student.guardianRg,
      guardianPhone: student.guardianPhone,
      guardianRelationship: student.guardianRelationship,
    },
  });
}
