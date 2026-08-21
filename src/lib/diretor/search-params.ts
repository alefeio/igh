import { z } from "zod";

export const directorScopeSchema = z.enum(["current", "all", "cycle"]).default("current");

export const overviewQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: z.string().uuid().optional(),
});

export const prioritiesQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: z.string().uuid().optional(),
  severity: z.enum(["critical", "attention", "all"]).default("all"),
  domain: z.enum(["academic", "offer", "all"]).default("all"),
});

export const academicQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  classGroupId: z.string().uuid().optional(),
  poloId: z.string().uuid().optional(),
});

export const offerQuerySchema = z.object({
  scope: directorScopeSchema,
  cycleId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  poloId: z.string().uuid().optional(),
});

export function parseSearchParams<T extends z.ZodTypeAny>(
  schema: T,
  url: URL,
): z.infer<T> {
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
