import { authErrorResponse } from "@/lib/api-auth-guard";
import { employeePositionText } from "@/lib/employees";
import {
  ensureEmployeeInvoiceDueReminders,
  getEmployeeInvoiceDueStatus,
} from "@/lib/employee-invoice-reminders";
import { requireEmployeePortal } from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateEmployeePortalProfileSchema } from "@/lib/validators/employee-portal";

const profileSelect = {
  id: true,
  name: true,
  cpf: true,
  status: true,
  photoUrl: true,
  position: true,
  positionLabel: true,
  employmentType: true,
  email: true,
  phone: true,
  meiCnpj: true,
  meiCompanyName: true,
  bankName: true,
  bankAgency: true,
  bankAccount: true,
  bankAccountType: true,
  pixKeyType: true,
  pixKey: true,
  cep: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
} as const;

export async function GET() {
  try {
    const { employee } = await requireEmployeePortal();
    // Dispara lembretes (dedupe) ao acessar o portal — cobre ambientes sem cron.
    void ensureEmployeeInvoiceDueReminders().catch(() => undefined);

    const full = await prisma.employee.findFirstOrThrow({
      where: { id: employee.id },
      select: profileSelect,
    });

    const [pendingInvoices, unreadMessages, invoiceDue] = await Promise.all([
      prisma.employeeInvoiceSubmission.count({
        where: { employeeId: employee.id, status: "PENDENTE" },
      }),
      prisma.employeePortalThread.count({
        where: { employeeId: employee.id, unreadByEmployee: true },
      }),
      getEmployeeInvoiceDueStatus(employee.id, {
        employmentType: full.employmentType,
        status: full.status,
      }),
    ]);

    return jsonOk({
      employee: {
        ...full,
        positionLabel: employeePositionText(full),
      },
      pendingInvoices,
      unreadMessages,
      invoiceDue,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function PATCH(request: Request) {
  let ctx;
  try {
    ctx = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEmployeePortalProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;
  const employee = await prisma.employee.update({
    where: { id: ctx.employee.id },
    data: {
      ...(d.photoUrl !== undefined ? { photoUrl: d.photoUrl } : {}),
      ...(d.email !== undefined ? { email: d.email } : {}),
      ...(d.phone !== undefined ? { phone: d.phone } : {}),
      ...(d.cep !== undefined ? { cep: d.cep } : {}),
      ...(d.street !== undefined ? { street: d.street } : {}),
      ...(d.number !== undefined ? { number: d.number } : {}),
      ...(d.complement !== undefined ? { complement: d.complement } : {}),
      ...(d.neighborhood !== undefined ? { neighborhood: d.neighborhood } : {}),
      ...(d.city !== undefined ? { city: d.city } : {}),
      ...(d.state !== undefined ? { state: d.state } : {}),
      ...(d.bankName !== undefined ? { bankName: d.bankName } : {}),
      ...(d.bankAgency !== undefined ? { bankAgency: d.bankAgency } : {}),
      ...(d.bankAccount !== undefined ? { bankAccount: d.bankAccount } : {}),
      ...(d.bankAccountType !== undefined ? { bankAccountType: d.bankAccountType } : {}),
      ...(d.pixKeyType !== undefined ? { pixKeyType: d.pixKeyType } : {}),
      ...(d.pixKey !== undefined ? { pixKey: d.pixKey } : {}),
      ...(d.meiCnpj !== undefined ? { meiCnpj: d.meiCnpj } : {}),
      ...(d.meiCompanyName !== undefined ? { meiCompanyName: d.meiCompanyName } : {}),
    },
    select: profileSelect,
  });

  return jsonOk({
    employee: {
      ...employee,
      positionLabel: employeePositionText(employee),
    },
  });
}
