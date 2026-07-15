import { randomUUID } from "node:crypto";
import type { Student } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Prefixos usados como CPF "placeholder" quando ainda não temos o CPF real do aluno.
 * "MENOR-" é usado em cadastros de menores sem CPF; "PENDENTE-" é usado quando o
 * cadastro do aluno é criado automaticamente a partir de um usuário (ex.: quem se
 * registrou pela conta mas ainda não preencheu o cadastro completo).
 */
const PLACEHOLDER_CPF_PREFIXES = ["MENOR-", "PENDENTE-"] as const;

/** Data sentinela usada como nascimento provisório em cadastros criados automaticamente. */
const PLACEHOLDER_BIRTHDATE = new Date(0);

export function isPlaceholderCpf(cpf: string | null | undefined): boolean {
  if (!cpf) return true;
  return PLACEHOLDER_CPF_PREFIXES.some((prefix) => cpf.startsWith(prefix));
}

/** Retorna o CPF real ou string vazia quando é um placeholder (para exibição no formulário). */
export function displayStudentCpf(cpf: string | null | undefined): string {
  return isPlaceholderCpf(cpf) ? "" : cpf ?? "";
}

export function isPlaceholderBirthDate(date: Date | null | undefined): boolean {
  return !date || date.getTime() === PLACEHOLDER_BIRTHDATE.getTime();
}

/** Retorna a data de nascimento real ou null quando é a sentinela (para exibição no formulário). */
export function displayStudentBirthDate(date: Date | null | undefined): Date | null {
  return isPlaceholderBirthDate(date) ? null : date ?? null;
}

/**
 * Obtém o cadastro (Student) vinculado ao usuário logado; se não existir, cria um
 * cadastro mínimo vinculado ao userId.
 *
 * Todo aluno que existe na plataforma deve ter um registro de cadastro (dados
 * pessoais/documentos) independentemente de estar matriculado em algum curso. Como
 * o registro de conta (auth) cria apenas o User, esta função garante o Student
 * correspondente na primeira vez que o aluno acessa "Meus dados".
 */
export async function getOrCreateStudentForUser(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Promise<Student> {
  const existing = await prisma.student.findFirst({ where: { userId: user.id } });
  if (existing) return existing;

  try {
    return await prisma.student.create({
      data: {
        userId: user.id,
        name: user.name?.trim() || "",
        email: user.email ?? null,
        birthDate: PLACEHOLDER_BIRTHDATE,
        cpf: `PENDENTE-${randomUUID()}`,
        rg: "",
        phone: "",
        gender: "PREFER_NOT_SAY",
        educationLevel: "OTHER",
      },
    });
  } catch (error) {
    // Corrida: outra requisição (ex.: perfil e anexos carregam em paralelo) pode ter
    // criado o cadastro primeiro; userId é único, então buscamos novamente.
    const created = await prisma.student.findFirst({ where: { userId: user.id } });
    if (created) return created;
    throw error;
  }
}
