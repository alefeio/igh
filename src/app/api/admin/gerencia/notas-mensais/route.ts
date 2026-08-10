import { Prisma } from "@/generated/prisma/client";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createMonthlyInvoiceSchema } from "@/lib/validators/admin-documents";

function serializeInvoice(row: {
  id: string;
  employeeId: string;
  referenceMonth: Date;
  amountCents: number | null;
  status: string;
  issuedAt: Date | null;
  notes: string | null;
  pdfUrl: string | null;
  pdfPublicId: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: {
    id: string;
    name: string;
    cpf: string;
    position: string;
    positionLabel: string | null;
    employmentType?: string;
  };
}) {
  return {
    ...row,
    referenceMonth: row.referenceMonth.toISOString().slice(0, 10),
    issuedAt: row.issuedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
  const month = searchParams.get("month"); // YYYY-MM
  const employeeId = searchParams.get("employeeId");
  const employmentTypeRaw = searchParams.get("employmentType");
  const employmentTypes = ["MEI", "CLT", "PRESTADOR", "VOLUNTARIO", "ESTAGIO"] as const;
  const employmentType =
    employmentTypeRaw && (employmentTypes as readonly string[]).includes(employmentTypeRaw)
      ? (employmentTypeRaw as (typeof employmentTypes)[number])
      : undefined;

  let referenceMonth: Date | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    referenceMonth = new Date(Date.UTC(y, m - 1, 1));
  }

  const invoices = await prisma.employeeMonthlyInvoice.findMany({
    where: {
      deletedAt: null,
      ...(referenceMonth ? { referenceMonth } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(employmentType ? { employee: { employmentType } } : {}),
    },
    orderBy: [{ referenceMonth: "desc" }, { createdAt: "desc" }],
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          cpf: true,
          position: true,
          positionLabel: true,
          employmentType: true,
        },
      },
    },
  });

  return jsonOk({ invoices: invoices.map(serializeInvoice) });
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
  const parsed = createMonthlyInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);

  try {
    const invoice = await prisma.employeeMonthlyInvoice.create({
      data: {
        employeeId: data.employeeId,
        referenceMonth: data.referenceMonth,
        amountCents: data.amount ?? null,
        status: data.status,
        notes: data.notes ?? null,
        pdfUrl: data.pdfUrl ?? null,
        pdfPublicId: data.pdfPublicId ?? null,
        issuedAt: data.issuedAt ?? (data.status === "ENTREGUE" ? new Date() : null),
        createdByUserId: actor.id,
      },
      include: {
        employee: {
          select: { id: true, name: true, cpf: true, position: true, positionLabel: true },
        },
      },
    });

    await createAuditLog({
      entityType: "EmployeeMonthlyInvoice",
      entityId: invoice.id,
      action: "CREATE",
      diff: { employeeId: invoice.employeeId, referenceMonth: data.referenceMonth.toISOString() },
      performedByUserId: actor.id,
    });

    return jsonOk({ invoice: serializeInvoice(invoice) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe nota para este colaborador nesta competência.", 409);
    }
    throw e;
  }
}
