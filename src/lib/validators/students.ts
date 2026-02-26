import { z } from "zod";

/** Remove tudo que não for dígito */
export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const genderEnum = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_SAY"]);
const studyShiftEnum = z.enum(["MORNING", "AFTERNOON", "EVENING", "FULL"]);
const educationLevelEnum = z.enum([
  "NONE",
  "ELEMENTARY_INCOMPLETE",
  "ELEMENTARY_COMPLETE",
  "HIGH_INCOMPLETE",
  "HIGH_COMPLETE",
  "COLLEGE_INCOMPLETE",
  "COLLEGE_COMPLETE",
  "OTHER",
]);

const cpfSchema = z
  .string()
  .min(1, "CPF é obrigatório")
  .transform((v) => normalizeDigits(v))
  .refine((v) => v.length === 11, "CPF deve ter 11 dígitos");

const phoneSchema = z
  .string()
  .min(1, "Celular é obrigatório")
  .transform((v) => normalizeDigits(v))
  .refine((v) => v.length >= 10, "Celular deve ter no mínimo 10 dígitos");

const optionalCpfSchema = z
  .string()
  .optional()
  .transform((v) => (v == null || v === "" ? undefined : normalizeDigits(v)))
  .refine((v) => v === undefined || v.length === 11, "CPF do responsável deve ter 11 dígitos")
  .optional();

const optionalPhoneSchema = z
  .string()
  .optional()
  .transform((v) => (v == null || v === "" ? undefined : normalizeDigits(v)))
  .refine((v) => v === undefined || v.length >= 10, "Celular do responsável deve ter no mínimo 10 dígitos")
  .optional();

function isMinor(birthDate: Date): boolean {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age < 18;
}

const baseStudentSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória").refine(
    (v) => !Number.isNaN(Date.parse(v)),
    "Data inválida"
  ),
  cpf: cpfSchema,
  rg: z.string().min(1, "RG é obrigatório"),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]).optional(),
  phone: phoneSchema,
  cep: z
    .string()
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : normalizeDigits(v)))
    .refine((v) => v === undefined || v.length === 8, "CEP deve ter 8 dígitos")
    .optional(),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().length(2, "UF deve ter 2 caracteres"),
  gender: genderEnum,
  hasDisability: z.boolean().default(false),
  disabilityDescription: z.string().optional(),
  educationLevel: educationLevelEnum,
  isStudying: z.boolean().default(false),
  studyShift: studyShiftEnum.optional().nullable(),
  guardianName: z.string().optional(),
  guardianCpf: optionalCpfSchema,
  guardianRg: z.string().optional(),
  guardianPhone: optionalPhoneSchema,
  guardianRelationship: z.string().optional(),
});

export const createStudentSchema = baseStudentSchema
  .refine(
    (data) => !data.hasDisability || (data.disabilityDescription?.trim().length ?? 0) >= 3,
    { message: "Se possui deficiência, informe qual (mín. 3 caracteres).", path: ["disabilityDescription"] }
  )
  .refine(
    (data) => !data.isStudying || (data.studyShift != null && data.studyShift !== ""),
    { message: "Se está estudando, informe o turno.", path: ["studyShift"] }
  )
  .refine(
    (data) => {
      const birth = new Date(data.birthDate);
      if (!isMinor(birth)) return true;
      const hasGuardian =
        (data.guardianName?.trim().length ?? 0) >= 2 &&
        (data.guardianCpf?.length ?? 0) === 11 &&
        (data.guardianPhone?.length ?? 0) >= 10 &&
        (data.guardianRelationship?.trim().length ?? 0) >= 1;
      return hasGuardian;
    },
    {
      message:
        "Menor de 18 anos: preencha nome, CPF, celular e parentesco do responsável.",
      path: ["guardianName"],
    }
  );

const partialBase = baseStudentSchema.partial().extend({
  birthDate: z.string().optional().refine((v) => v == null || v === "" || !Number.isNaN(Date.parse(v!)), "Data inválida"),
  cpf: z.string().min(1).transform((v) => normalizeDigits(v)).refine((v) => v.length === 11, "CPF deve ter 11 dígitos").optional(),
  phone: z.string().min(1).transform((v) => normalizeDigits(v)).refine((v) => v.length >= 10, "Celular mínimo 10 dígitos").optional(),
  state: z.string().length(2, "UF deve ter 2 caracteres").optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]).optional(),
  guardianCpf: optionalCpfSchema,
  guardianPhone: optionalPhoneSchema,
});

export const updateStudentSchema = partialBase
  .refine(
    (data) => data.hasDisability !== true || (data.disabilityDescription?.trim().length ?? 0) >= 3,
    { message: "Se possui deficiência, informe qual (mín. 3 caracteres).", path: ["disabilityDescription"] }
  )
  .refine(
    (data) => data.isStudying !== true || (data.studyShift != null && data.studyShift !== ""),
    { message: "Se está estudando, informe o turno.", path: ["studyShift"] }
  )
  .refine(
    (data) => {
      const birth = data.birthDate ? new Date(data.birthDate) : null;
      if (!birth || !isMinor(birth)) return true;
      const name = (data.guardianName?.trim().length ?? 0) >= 2;
      const cpf = (data.guardianCpf?.length ?? 0) === 11;
      const phone = (data.guardianPhone?.length ?? 0) >= 10;
      const rel = (data.guardianRelationship?.trim().length ?? 0) >= 1;
      return name && cpf && phone && rel;
    },
    {
      message:
        "Menor de 18 anos: preencha nome, CPF, celular e parentesco do responsável.",
      path: ["guardianName"],
    }
  );

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
