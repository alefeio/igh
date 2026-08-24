import { z } from "zod";

export const metricValueSchema = z.object({
  metricId: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  unit: z.string().optional(),
  unavailableReason: z.string().nullable().optional(),
  quality: z.enum(["ok", "partial", "unavailable", "estimated"]),
  formulaVersion: z.string(),
  formula: z.string(),
  denominator: z.string().optional(),
  explanation: z.string().optional(),
  href: z.string().optional(),
  currentValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  percentage: z.number().nullable().optional(),
  formattedValue: z.string().optional(),
});

export const qualityFlagSchema = z.object({
  domain: z.string(),
  status: z.enum(["ok", "partial", "unavailable"]),
  note: z.string().optional(),
});

export const responseMetaSchema = z.object({
  generatedAt: z.string(),
  dataAsOf: z.string(),
  filters: z.record(z.string(), z.unknown()),
  quality: z.array(qualityFlagSchema),
  formulaVersion: z.string().optional(),
  viewer: z.enum(["DIRECTOR", "MASTER"]).optional(),
});

export const directorDomainSchema = z.enum([
  "academic",
  "offer",
  "financial",
  "administrative",
  "social",
  "projects",
  "overview",
]);

export const derivedAlertSchema = z.object({
  id: z.string(),
  ruleId: z.string().optional(),
  ruleVersion: z.string().optional(),
  domain: directorDomainSchema,
  severity: z.enum(["critical", "attention", "info"]),
  title: z.string(),
  fact: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  denominator: z.string().optional(),
  period: z.string().optional(),
  impact: z.string().optional(),
  suggestedDecision: z.string().optional(),
  metricId: z.string().optional(),
  href: z.string(),
  source: z.string(),
  operationalOwner: z.string().optional(),
  status: z.string().optional(),
});

export type MetricValueDto = z.infer<typeof metricValueSchema>;
export type ResponseMetaDto = z.infer<typeof responseMetaSchema>;
export type DerivedAlertDto = z.infer<typeof derivedAlertSchema>;
export const OPERATIONAL_FOLLOWUP = "Acompanhamento operacional ainda não registrado.";
