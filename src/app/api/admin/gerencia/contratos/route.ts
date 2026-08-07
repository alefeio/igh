import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { renderDocumentHtmlToPdfBytes } from "@/lib/admin/document-template-pdf";
import {
  buildDocumentVariableMap,
  renderDocumentTemplateHtml,
} from "@/lib/admin/document-template-vars";
import { uploadGerenciaPdfBytes } from "@/lib/admin/gerencia-pdf-upload";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createEmployeeContractSchema } from "@/lib/validators/admin-documents";

const contractInclude = {
  employee: {
    select: { id: true, name: true, cpf: true, position: true, positionLabel: true, status: true },
  },
  template: { select: { id: true, title: true, type: true } },
  parentContract: { select: { id: true, startDate: true, monthlyValueCents: true } },
} as const;

function serializeContract(c: {
  id: string;
  employeeId: string;
  templateId: string | null;
  kind: string;
  parentContractId: string | null;
  startDate: Date;
  endDate: Date | null;
  monthlyValueCents: number | null;
  description: string | null;
  status: string;
  renderedHtml: string;
  pdfUrl: string | null;
  pdfPublicId: string | null;
  signedPdfUrl: string | null;
  signedPdfPublicId: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee: { id: string; name: string; cpf: string; position: string; positionLabel: string | null; status: string };
  template: { id: string; title: string; type: string } | null;
  parentContract: { id: string; startDate: Date; monthlyValueCents: number | null } | null;
}) {
  return {
    ...c,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : null,
    issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    parentContract: c.parentContract
      ? {
          ...c.parentContract,
          startDate: c.parentContract.startDate.toISOString().slice(0, 10),
        }
      : null,
  };
}

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const employeeId = searchParams.get("employeeId");

  const contracts = await prisma.employeeContract.findMany({
    where: {
      deletedAt: null,
      ...(kind === "CONTRATO" || kind === "DISTRATO" ? { kind } : {}),
      ...(employeeId ? { employeeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: contractInclude,
  });

  return jsonOk({ contracts: contracts.map(serializeContract) });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createEmployeeContractSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  const [employee, template] = await Promise.all([
    prisma.employee.findFirst({ where: { id: data.employeeId, deletedAt: null } }),
    prisma.documentTemplate.findFirst({
      where: { id: data.templateId, isActive: true },
    }),
  ]);
  if (!employee) return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);
  if (!template) return jsonErr("NOT_FOUND", "Modelo não encontrado ou inativo.", 404);

  if (data.kind === "DISTRATO" && data.parentContractId) {
    const parent = await prisma.employeeContract.findFirst({
      where: {
        id: data.parentContractId,
        employeeId: data.employeeId,
        kind: "CONTRATO",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!parent) {
      return jsonErr("NOT_FOUND", "Contrato original não encontrado para este colaborador.", 404);
    }
  }

  const issuedAt = new Date();
  const vars = buildDocumentVariableMap(employee, {
    startDate: data.startDate,
    endDate: data.endDate,
    monthlyValueCents: data.monthlyValue,
    issuedAt,
  });
  const renderedHtml = renderDocumentTemplateHtml(template.contentRich, vars);

  let pdfUrl: string | null = null;
  let pdfPublicId: string | null = null;
  if (data.generatePdf) {
    try {
      const bytes = await renderDocumentHtmlToPdfBytes(renderedHtml, template.title);
      const uploaded = await uploadGerenciaPdfBytes(
        bytes,
        `${data.kind.toLowerCase()}-${employee.name.replace(/\s+/g, "-").slice(0, 40)}.pdf`,
      );
      pdfUrl = uploaded.url;
      pdfPublicId = uploaded.publicId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao gerar PDF.";
      return jsonErr("PDF_ERROR", message, 500);
    }
  }

  const contract = await prisma.$transaction(async (tx) => {
    const created = await tx.employeeContract.create({
      data: {
        employeeId: data.employeeId,
        templateId: data.templateId,
        kind: data.kind,
        parentContractId: data.parentContractId ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        monthlyValueCents: data.monthlyValue ?? null,
        description: data.description ?? null,
        status: data.status,
        renderedHtml,
        pdfUrl,
        pdfPublicId,
        issuedAt,
        createdByUserId: actor.id,
      },
      include: contractInclude,
    });

    if (data.kind === "DISTRATO" && data.parentContractId) {
      await tx.employeeContract.update({
        where: { id: data.parentContractId },
        data: { status: "ENCERRADO", endDate: data.endDate ?? data.startDate },
      });
      await tx.employee.update({
        where: { id: data.employeeId },
        data: {
          status: "DESLIGADO",
          terminationDate: data.endDate ?? data.startDate,
        },
      });
    }

    return created;
  });

  await createAuditLog({
    entityType: "EmployeeContract",
    entityId: contract.id,
    action: "CREATE",
    diff: { kind: contract.kind, employeeId: contract.employeeId, templateId: contract.templateId },
    performedByUserId: actor.id,
  });

  return jsonOk({ contract: serializeContract(contract) }, { status: 201 });
}
