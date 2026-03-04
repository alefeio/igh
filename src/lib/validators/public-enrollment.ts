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

export const createPublicStudentSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(200),
    cpf: z.string().min(11, "CPF inválido").refine((v) => isValidCPF(v), "CPF inválido"),
    birthDate: z.string().min(1, "Data de nascimento obrigatória"),
    phone: z.string().min(10, "Telefone inválido"),
    email: z
      .string()
      .optional()
      .transform((s) => (typeof s === "string" && s.trim() ? s.trim().toLowerCase() : null)),
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
  );

export const createPreEnrollmentSchema = z.object({
  classGroupId: z.string().uuid(),
  studentToken: z.string().optional(),
});
