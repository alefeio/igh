import { z } from "zod";

const onlyDigits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf, 11);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  if (rev !== parseInt(d[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  return rev === parseInt(d[10], 10);
}

function ageFromBirthDate(birthDate: string): number | null {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export const createPublicStudentSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(200),
    cpf: z
      .string()
      .optional()
      .transform((s) => (typeof s === "string" && s.trim() ? s.trim() : null)),
    birthDate: z.string().min(1, "Data de nascimento obrigatória"),
    phone: z.string().min(10, "Telefone inválido"),
    email: z
      .string()
      .optional()
      .transform((s) => (typeof s === "string" && s.trim() ? s.trim().toLowerCase() : null)),
    guardianCpf: z
      .string()
      .optional()
      .transform((s) => (typeof s === "string" && s.trim() ? s.trim() : null)),
  })
  .refine(
    (data) => {
      if (data.email == null || data.email === "") return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
    },
    { message: "E-mail inválido", path: ["email"] }
  )
  .refine(
    (data) => {
      const d = new Date(data.birthDate);
      return !Number.isNaN(d.getTime()) && d < new Date();
    },
    { message: "Data de nascimento inválida", path: ["birthDate"] }
  )
  .refine(
    (data) => {
      const age = ageFromBirthDate(data.birthDate);
      if (age == null || age >= 18) return true;
      return data.guardianCpf != null && data.guardianCpf.replace(/\D/g, "").length === 11;
    },
    { message: "Para menores de 18 anos é obrigatório informar o CPF do responsável.", path: ["guardianCpf"] }
  )
  .refine(
    (data) => {
      const age = ageFromBirthDate(data.birthDate);
      if (age == null || age >= 18 || !data.guardianCpf) return true;
      return isValidCPF(data.guardianCpf);
    },
    { message: "CPF do responsável inválido.", path: ["guardianCpf"] }
  )
  .refine(
    (data) => {
      const age = ageFromBirthDate(data.birthDate);
      if (age != null && age < 18) return true;
      return data.cpf != null && data.cpf.replace(/\D/g, "").length === 11;
    },
    { message: "CPF é obrigatório para maiores de 18 anos.", path: ["cpf"] }
  )
  .refine(
    (data) => {
      const age = ageFromBirthDate(data.birthDate);
      if (age != null && age < 18 && (data.cpf == null || data.cpf.replace(/\D/g, "").length === 0)) return true;
      if (data.cpf == null || data.cpf.replace(/\D/g, "").length === 0) return true;
      return isValidCPF(data.cpf);
    },
    { message: "CPF do aluno inválido.", path: ["cpf"] }
  );

export const createPreEnrollmentSchema = z.object({
  classGroupId: z.string().uuid(),
  studentToken: z.string().optional(),
});
