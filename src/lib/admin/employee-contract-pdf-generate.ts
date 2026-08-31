import "server-only";

import type { Employee } from "@/generated/prisma/client";
import { renderDocumentHtmlToPdfBytes } from "@/lib/admin/document-template-pdf";
import {
  buildDocumentVariableMap,
  renderDocumentTemplateHtml,
} from "@/lib/admin/document-template-vars";
import {
  isMeiServiceContractTemplate,
  renderMeiServiceContractPdfBytes,
} from "@/lib/admin/employee-contract-mei-pdf";
import { donorInstitutionVariableMap, resolveDonorInstitution } from "@/lib/donor-institution";

export type EmployeeContractPdfInput = {
  employee: Employee;
  template: { title: string; contentRich: string } | null;
  kind: string;
  startDate: Date;
  endDate: Date | null;
  monthlyValueCents: number | null;
  issuedAt: Date;
  /** Usado quando o modelo foi removido — mantém o HTML já emitido. */
  fallbackRenderedHtml?: string | null;
};

export function employeeContractPdfFileName(kind: string, employeeName: string): string {
  return `${kind.toLowerCase()}-${employeeName.replace(/\s+/g, "-").slice(0, 40)}.pdf`;
}

/** Monta HTML e bytes do PDF a partir dos dados atuais do contrato. */
export async function buildEmployeeContractPdfArtifacts(input: EmployeeContractPdfInput): Promise<{
  bytes: Uint8Array;
  renderedHtml: string;
}> {
  const donor = await resolveDonorInstitution();
  const vars = buildDocumentVariableMap(
    input.employee,
    {
      startDate: input.startDate,
      endDate: input.endDate,
      monthlyValueCents: input.monthlyValueCents,
      issuedAt: input.issuedAt,
    },
    donorInstitutionVariableMap(donor),
  );

  const renderedHtml = input.template
    ? renderDocumentTemplateHtml(input.template.contentRich, vars)
    : input.fallbackRenderedHtml?.trim() ?? "";

  if (!renderedHtml) {
    throw new Error("Modelo indisponível para gerar o PDF.");
  }

  const bytes =
    input.kind === "CONTRATO" && input.template && isMeiServiceContractTemplate(input.template.title)
      ? await renderMeiServiceContractPdfBytes(vars)
      : await renderDocumentHtmlToPdfBytes(renderedHtml, input.template?.title);

  return { bytes, renderedHtml };
}
