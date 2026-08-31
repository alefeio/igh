import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  buildEmployeeContractPdfArtifacts,
  employeeContractPdfFileName,
} from "@/lib/admin/employee-contract-pdf-generate";
import { uploadGerenciaPdfBytes } from "@/lib/admin/gerencia-pdf-upload";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const contractInclude = {
  employee: true,
  template: { select: { id: true, title: true, type: true, contentRich: true } },
} as const;

function safeFileName(name: string): string {
  return name.replace(/[\r\n"]/g, "").trim().slice(0, 180) || "contrato.pdf";
}

function serializeContract(contract: {
  id: string;
  kind: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  monthlyValueCents: number | null;
  pdfUrl: string | null;
  signedPdfUrl: string | null;
  employee: {
    id: string;
    name: string;
    cpf: string;
    position: string;
    positionLabel: string | null;
    status: string;
  };
  template: { id: string; title: string; type: string } | null;
}) {
  return {
    id: contract.id,
    kind: contract.kind,
    status: contract.status,
    startDate: contract.startDate.toISOString().slice(0, 10),
    endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
    monthlyValueCents: contract.monthlyValueCents,
    pdfUrl: contract.pdfUrl,
    signedPdfUrl: contract.signedPdfUrl,
    employee: contract.employee,
    template: contract.template
      ? { id: contract.template.id, title: contract.template.title, type: contract.template.type }
      : null,
  };
}

/** Proxy do PDF do contrato: inline (visualizar) ou attachment (download=1). */
export async function GET(request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "1";
  const variant = searchParams.get("variant");

  const contract = await prisma.employeeContract.findFirst({
    where: { id, deletedAt: null },
    select: {
      pdfUrl: true,
      signedPdfUrl: true,
      kind: true,
      employee: { select: { name: true } },
    },
  });
  if (!contract) {
    return jsonErr("NOT_FOUND", "Contrato não encontrado.", 404);
  }

  const pdfUrl = variant === "signed" ? contract.signedPdfUrl : contract.pdfUrl;
  if (!pdfUrl) {
    return jsonErr("NOT_FOUND", "PDF do contrato não encontrado.", 404);
  }

  const upstream = await fetch(pdfUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return jsonErr("FETCH_FAILED", "Não foi possível obter o PDF do contrato.", 502);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const filename = safeFileName(
    `${contract.kind.toLowerCase()}-${contract.employee.name.replace(/\s+/g, "-").slice(0, 40)}.pdf`,
  );

  const contentType =
    upstream.headers.get("content-type")?.includes("pdf") ||
    pdfUrl.toLowerCase().includes(".pdf")
      ? "application/pdf"
      : upstream.headers.get("content-type") || "application/octet-stream";

  return new Response(buf, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}

/** Regera o PDF do contrato com os dados atuais do colaborador e do modelo. */
export async function POST(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.employeeContract.findFirst({
    where: { id, deletedAt: null },
    include: contractInclude,
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Contrato não encontrado.", 404);
  }

  const issuedAt = existing.issuedAt ?? existing.startDate;

  try {
    const artifacts = await buildEmployeeContractPdfArtifacts({
      employee: existing.employee,
      template: existing.template,
      kind: existing.kind,
      startDate: existing.startDate,
      endDate: existing.endDate,
      monthlyValueCents: existing.monthlyValueCents,
      issuedAt,
      fallbackRenderedHtml: existing.renderedHtml,
    });
    const uploaded = await uploadGerenciaPdfBytes(
      artifacts.bytes,
      employeeContractPdfFileName(existing.kind, existing.employee.name),
    );

    const contract = await prisma.employeeContract.update({
      where: { id },
      data: {
        renderedHtml: artifacts.renderedHtml,
        pdfUrl: uploaded.url,
        pdfPublicId: uploaded.publicId,
      },
      include: {
        employee: {
          select: { id: true, name: true, cpf: true, position: true, positionLabel: true, status: true },
        },
        template: { select: { id: true, title: true, type: true } },
      },
    });

    await createAuditLog({
      entityType: "EmployeeContract",
      entityId: id,
      action: "UPDATE",
      diff: { regeneratePdf: true },
      performedByUserId: actor.id,
    });

    return jsonOk({ contract: serializeContract(contract) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao regerar PDF.";
    return jsonErr("PDF_ERROR", message, 500);
  }
}
