import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { displayStudentBirthDate, displayStudentCpf, getOrCreateStudentForUser } from "@/lib/student-account";

/** Retorna o perfil completo do aluno (para a página Meus dados). Apenas STUDENT, próprio cadastro. */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  // O cadastro do aluno existe independentemente de haver matrículas em cursos. Se o
  // usuário ainda não tiver um Student vinculado (ex.: registrou a conta e nunca se
  // matriculou), criamos um cadastro mínimo vinculado ao userId.
  const student = await getOrCreateStudentForUser(user);

  return jsonOk({
    student: {
      id: student.id,
      name: student.name,
      birthDate: displayStudentBirthDate(student.birthDate),
      cpf: displayStudentCpf(student.cpf),
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
