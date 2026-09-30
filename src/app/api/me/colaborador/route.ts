import { authErrorResponse } from "@/lib/api-auth-guard";
import { employeePositionText } from "@/lib/employees";
import {
  ensureEmployeeInvoiceDueReminders,
  getEmployeeInvoiceDueStatus,
} from "@/lib/employee-invoice-reminders";
import { requireEmployeePortal } from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { birthDateInputToDate } from "@/lib/validators/person-contact";
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
  rg: true,
  rgIssuer: true,
  birthDate: true,
  uniformSize: true,
  shoeSize: true,
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
        birthDate: full.birthDate ? full.birthDate.toISOString().slice(0, 10) : null,
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
  if (d.cpf) {
    const takenCpf = await prisma.employee.findFirst({
      where: { cpf: d.cpf, id: { not: ctx.employee.id } },
      select: { id: true },
    });
    if (takenCpf) {
      return jsonErr("CPF_IN_USE", "Este CPF já está cadastrado em outra ficha.", 409);
    }
  }

  const nextEmail = d.email?.trim().toLowerCase();
  if (nextEmail) {
    const takenEmail = await prisma.user.findFirst({
      where: { email: nextEmail, id: { not: ctx.user.id } },
      select: { id: true },
    });
    if (takenEmail) {
      return jsonErr("EMAIL_IN_USE", "Este e-mail já está em uso por outra conta.", 409);
    }
  }

  const employee = await prisma.employee.update({
    where: { id: ctx.employee.id },
    data: {
      ...(d.photoUrl !== undefined ? { photoUrl: d.photoUrl } : {}),
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.cpf !== undefined ? { cpf: d.cpf } : {}),
      ...(d.rg !== undefined ? { rg: d.rg } : {}),
      ...(d.rgIssuer !== undefined ? { rgIssuer: d.rgIssuer } : {}),
      ...(d.birthDate !== undefined ? { birthDate: birthDateInputToDate(d.birthDate) } : {}),
      ...(d.uniformSize !== undefined ? { uniformSize: d.uniformSize } : {}),
      ...(d.shoeSize !== undefined ? { shoeSize: d.shoeSize } : {}),
      ...(d.email !== undefined ? { email: nextEmail ?? null } : {}),
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

  if (d.name !== undefined || d.email !== undefined || d.phone !== undefined || d.birthDate !== undefined) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ctx.user.id },
        data: {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(nextEmail ? { email: nextEmail } : {}),
          ...(d.phone !== undefined ? { whatsapp: d.phone } : {}),
          ...(d.birthDate !== undefined ? { birthDate: birthDateInputToDate(d.birthDate) } : {}),
        },
      });
      const teacher = await tx.teacher.findFirst({
        where: { userId: ctx.user.id, deletedAt: null },
        select: { id: true },
      });
      if (teacher) {
        await tx.teacher.update({
          where: { id: teacher.id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(nextEmail ? { email: nextEmail } : {}),
            ...(d.phone !== undefined ? { phone: d.phone } : {}),
          },
        });
      }
    });
  }

  return jsonOk({
    employee: {
      ...employee,
      birthDate: employee.birthDate ? employee.birthDate.toISOString().slice(0, 10) : null,
      positionLabel: employeePositionText(employee),
    },
  });
}
