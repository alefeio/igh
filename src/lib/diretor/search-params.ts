import { z } from "zod";

export const directorScopeSchema = z.enum(["current", "all", "cycle"]).default("current");

const uuidOpt = z.string().uuid().optional();
const ym = z.string().regex(/^\d{4}-\d{2}$/).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const overviewQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: uuidOpt,
  execCompetence: ym,
});

export const prioritiesQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: uuidOpt,
  severity: z.enum(["critical", "attention", "info", "all"]).default("all"),
  domain: z
    .enum(["academic", "offer", "financial", "administrative", "social", "projects", "all"])
    .default("all"),
  execCompetence: ym,
});

export const academicQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: uuidOpt,
  courseId: uuidOpt,
  classGroupId: uuidOpt,
  poloId: uuidOpt,
});

export const offerQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: uuidOpt,
  courseId: uuidOpt,
  poloId: uuidOpt,
});

export const socialQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  cycleId: uuidOpt,
  poloId: uuidOpt,
  courseId: uuidOpt,
});

export const financialQuerySchema = z.object({
  competence: ym,
  from: isoDate,
  to: isoDate,
  categoryId: uuidOpt,
  poloId: uuidOpt,
});

export const administrativeQuerySchema = z.object({
  competence: ym,
  from: isoDate,
  to: isoDate,
});

export const projectsQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/).optional(),
  from: isoDate,
  to: isoDate,
});

export const reportsQuerySchema = z.object({
  type: z
    .enum([
      "executive",
      "academic",
      "offer",
      "social",
      "financial",
      "administrative",
    ])
    .optional(),
});

export const reportsGenerateSchema = z.object({
  type: z.enum(["executive", "academic", "offer", "social", "financial", "administrative"]),
  format: z.enum(["json", "csv"]).default("json"),
  scope: directorScopeSchema.optional(),
  cycleId: uuidOpt,
  competence: ym,
  from: isoDate,
  to: isoDate,
});

export function parseSearchParams<T extends z.ZodTypeAny>(schema: T, url: URL): z.infer<T> {
  const raw: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (v) raw[k] = v;
  });
  return schema.parse(raw);
}

export function buildDirectorHref(
  path: string,
  params: Record<string, string | undefined | null>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}
