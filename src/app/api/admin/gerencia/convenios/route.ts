import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { ensurePaymentAgreementsSeeded } from "@/lib/payment-agreements";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createPaymentAgreementSchema } from "@/lib/validators/goals-agreements";
import { employeePositionText, type EmployeePosition } from "@/lib/employees";

function serializeBoardEmployee(e: {
  id: string;
  name: string;
  cpf: string;
  position: EmployeePosition;
  positionLabel: string | null;
  status: string;
  monthlyPayCents: number | null;
  paymentAgreementId: string | null;
}) {
  return {
    id: e.id,
    name: e.name,
    cpf: e.cpf,
    positionLabel: employeePositionText(e),
    status: e.status,
    monthlyPayCents: e.monthlyPayCents,
    paymentAgreementId: e.paymentAgreementId,
  };
}

export async function GET() {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  await ensurePaymentAgreementsSeeded(actor.id);

  const [columns, employees] = await Promise.all([
    prisma.paymentAgreement.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ATIVO", "AFASTADO"] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        cpf: true,
        position: true,
        positionLabel: true,
        status: true,
        monthlyPayCents: true,
        paymentAgreementId: true,
      },
    }),
  ]);

  return jsonOk({
    columns: columns.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
    })),
    employees: employees.map(serializeBoardEmployee),
    unassigned: employees
      .filter((e) => !e.paymentAgreementId)
      .map(serializeBoardEmployee),
  });
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
  const parsed = createPaymentAgreementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const column = await prisma.paymentAgreement.create({
      data: { ...parsed.data, createdByUserId: actor.id },
    });
    await createAuditLog({
      entityType: "PaymentAgreement",
      entityId: column.id,
      action: "CREATE",
      diff: { name: column.name },
      performedByUserId: actor.id,
    });
    return jsonOk({ column }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe um convênio com este nome.", 409);
    }
    throw e;
  }
}
