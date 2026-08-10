import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const updateDonorInstitutionSchema = z.object({
  name: optionalText,
  document: optionalText,
  email: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  cep: optionalText,
  phone: optionalText,
  representativeName: optionalText,
  representativeRole: optionalText,
  representativeCpf: optionalText,
});
