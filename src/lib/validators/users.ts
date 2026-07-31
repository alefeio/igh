import { z } from "zod";
import { optionalBirthDateSchema, optionalPhoneDigitsSchema } from "@/lib/validators/person-contact";

const staffAccessRoleSchema = z.enum(["ADMIN", "COORDINATOR", "POLO_COORDINATOR"]);
const managedAccessRoleSchema = z.enum(["ADMIN", "COORDINATOR", "POLO_COORDINATOR", "GENERAL_ADMIN"]);

const managedRolesField = z
  .array(managedAccessRoleSchema)
  .min(1, "Selecione ao menos um tipo de acesso")
  .max(4)
  .optional();

export const createAdminSchema = z
  .object({
    name: z.string().min(2, "Nome é obrigatório"),
    email: z.string().email("E-mail inválido").toLowerCase(),
    /** @deprecated Prefira `roles`. Mantido por compatibilidade. */
    role: managedAccessRoleSchema.optional(),
    /** Um ou mais tipos de acesso administrativos. */
    roles: managedRolesField,
    phone: optionalPhoneDigitsSchema,
    birthDate: optionalBirthDateSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.roles?.length && !data.role) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione ao menos um tipo de acesso",
        path: ["roles"],
      });
    }
  });

export const updateAdminSchema = z
  .object({
    name: z.string().min(2, "Nome é obrigatório").optional(),
    email: z.string().email("E-mail inválido").toLowerCase().optional(),
    password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").optional().or(z.literal("")),
    isActive: z.boolean().optional(),
    /** @deprecated Prefira `roles`. */
    role: managedAccessRoleSchema.optional(),
    /** Substitui o conjunto de acessos administrativos do usuário. */
    roles: managedRolesField,
    phone: optionalPhoneDigitsSchema,
    birthDate: optionalBirthDateSchema,
  })
  .superRefine((data, ctx) => {
    if (data.roles !== undefined && data.roles.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione ao menos um tipo de acesso",
        path: ["roles"],
      });
    }
  });

export { staffAccessRoleSchema, managedAccessRoleSchema };
