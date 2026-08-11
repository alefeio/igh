import "server-only";

import type {
  EmployeeInvoiceSubmission,
  EmployeePortalMessage,
  EmployeePortalThread,
  EmployeePosition,
  EmployeeStatus,
} from "@/generated/prisma/client";
import { requireSessionUser, type SessionUser } from "@/lib/auth";
import { employeePositionText, formatCentsBRL, formatReferenceMonth } from "@/lib/employees";
import { matchCategoryName } from "@/lib/financeiro-invoice-parse";
import { resolveInitialPaymentStatus } from "@/lib/financeiro-payment";
import { prisma } from "@/lib/prisma";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

export type EmployeePortalRecord = {
  id: string;
  userId: string;
  name: string;
  status: EmployeeStatus;
  photoUrl: string | null;
  position: EmployeePosition;
  positionLabel: string | null;
};

export async function requireEmployeePortal(): Promise<{
  user: SessionUser;
  employee: EmployeePortalRecord;
}> {
  const user = await requireSessionUser();
  const employee = await prisma.employee.findFirst({
    where: { userId: user.id, deletedAt: null, status: { not: "DESLIGADO" } },
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
      photoUrl: true,
      position: true,
      positionLabel: true,
    },
  });
  if (!employee?.userId) {
    throw new Error("FORBIDDEN");
  }
  return { user, employee: { ...employee, userId: employee.userId } };
}

export async function listAdminManagerUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: { in: ["ADMIN_MANAGER", "MASTER", "GENERAL_ADMIN"] } }, { isAdminManager: true }],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function notifyAdminManagers(input: {
  kind: "EMPLOYEE_INVOICE_SUBMITTED" | "EMPLOYEE_PORTAL_MESSAGE";
  title: string;
  body: string;
  linkUrl: string;
  dedupeKey: string;
  exceptUserId?: string;
}): Promise<void> {
  const ids = await listAdminManagerUserIds();
  await Promise.all(
    ids
      .filter((id) => id !== input.exceptUserId)
      .map((userId) =>
        createUserNotificationIfNew({
          userId,
          kind: input.kind,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl,
          dedupeKey: `${input.dedupeKey}:${userId}`,
        }),
      ),
  );
}

const submissionInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      position: true,
      positionLabel: true,
      userId: true,
    },
  },
  reviewedByUser: { select: { id: true, name: true } },
} as const;

type SubmissionRow = EmployeeInvoiceSubmission & {
  employee: {
    id: string;
    name: string;
    position: EmployeePosition;
    positionLabel: string | null;
    userId: string | null;
  };
  reviewedByUser: { id: string; name: string } | null;
};

export function serializeInvoiceSubmission(row: SubmissionRow) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    employeePosition: employeePositionText(row.employee),
    referenceMonth: row.referenceMonth.toISOString().slice(0, 10),
    referenceMonthLabel: formatReferenceMonth(row.referenceMonth),
    amountCents: row.amountCents,
    amountLabel: formatCentsBRL(row.amountCents),
    description: row.description,
    supplier: row.supplier,
    invoiceNumber: row.invoiceNumber,
    fileUrl: row.fileUrl,
    filePublicId: row.filePublicId,
    fileName: row.fileName,
    status: row.status,
    reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByName: row.reviewedByUser?.name ?? null,
    financialEntryId: row.financialEntryId,
    monthlyInvoiceId: row.monthlyInvoiceId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getInvoiceSubmissionOrThrow(id: string): Promise<SubmissionRow> {
  const row = await prisma.employeeInvoiceSubmission.findUnique({
    where: { id },
    include: submissionInclude,
  });
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  return row;
}

export { submissionInclude };

const threadListSelect = {
  id: true,
  employeeId: true,
  subject: true,
  status: true,
  unreadByManager: true,
  unreadByEmployee: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: { id: true, name: true, position: true, positionLabel: true } },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { content: true, createdAt: true, isFromManager: true },
  },
};

export function serializeThreadListItem(
  row: {
    id: string;
    employeeId: string;
    subject: string;
    status: "ABERTA" | "ENCERRADA";
    unreadByManager: boolean;
    unreadByEmployee: boolean;
    createdAt: Date;
    updatedAt: Date;
    employee: { id: string; name: string; position: EmployeePosition; positionLabel: string | null };
    messages: Array<{ content: string; createdAt: Date; isFromManager: boolean }>;
  },
  audience: "employee" | "manager",
) {
  const last = row.messages[0];
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    employeePosition: employeePositionText(row.employee),
    subject: row.subject,
    status: row.status,
    unread: audience === "manager" ? row.unreadByManager : row.unreadByEmployee,
    lastMessage: last?.content ?? null,
    lastMessageAt: (last?.createdAt ?? row.updatedAt).toISOString(),
    lastFromManager: last?.isFromManager ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export { threadListSelect };

export function serializeThreadDetail(
  thread: EmployeePortalThread & {
    employee: { id: string; name: string; position: EmployeePosition; positionLabel: string | null };
    messages: Array<
      EmployeePortalMessage & { author: { id: string; name: string } }
    >;
  },
) {
  return {
    id: thread.id,
    employeeId: thread.employeeId,
    employeeName: thread.employee.name,
    employeePosition: employeePositionText(thread.employee),
    subject: thread.subject,
    status: thread.status,
    unreadByManager: thread.unreadByManager,
    unreadByEmployee: thread.unreadByEmployee,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messages: thread.messages.map((m) => ({
      id: m.id,
      authorUserId: m.authorUserId,
      authorName: m.author.name,
      isFromManager: m.isFromManager,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function findMeiSaidaCategoryId(): Promise<string | null> {
  const existing = await prisma.financialCategory.findMany({
    where: { kind: "SAIDA", isActive: true },
    select: { id: true, name: true },
  });
  const matched =
    matchCategoryName(existing, "Nota MEI/colaborador") ??
    matchCategoryName(existing, "Nota MEI") ??
    existing.find((c) => /mei|colaborador/i.test(c.name));
  return matched?.id ?? null;
}

export async function approveInvoiceSubmission(input: {
  submissionId: string;
  actorId: string;
  reviewNotes?: string | null;
  createFinancialEntry: boolean;
}): Promise<SubmissionRow> {
  const current = await getInvoiceSubmissionOrThrow(input.submissionId);
  if (current.status !== "PENDENTE") {
    throw new Error("ALREADY_REVIEWED");
  }

  const categoryId = input.createFinancialEntry ? await findMeiSaidaCategoryId() : null;
  const due = current.referenceMonth;
  const initial = resolveInitialPaymentStatus({ dueDate: due, alreadyPaid: false });

  const result = await prisma.$transaction(async (tx) => {
    let financialEntryId: string | null = null;
    if (input.createFinancialEntry) {
      if (!current.amountCents || current.amountCents <= 0) {
        throw new Error("AMOUNT_REQUIRED");
      }
      const entry = await tx.financialEntry.create({
        data: {
          kind: "SAIDA",
          description:
            current.description?.trim() ||
            `Nota mensal — ${current.employee.name} (${formatReferenceMonth(current.referenceMonth)})`,
          amountCents: current.amountCents,
          entryDate: due,
          paymentStatus: initial.paymentStatus,
          paidAt: initial.paidAt,
          categoryId,
          paymentMethod: "PIX",
          responsibleUserId: current.employee.userId,
          responsibleName: current.employee.name,
          invoiceNumber: current.invoiceNumber,
          supplier: current.supplier,
          notes: input.reviewNotes?.trim() || null,
          attachmentUrl: current.fileUrl,
          attachmentPublicId: current.filePublicId,
          attachmentFileName: current.fileName,
          createdByUserId: input.actorId,
        },
        select: { id: true },
      });
      financialEntryId = entry.id;
    }

    await tx.employeeDocument.updateMany({
      where: {
        employeeId: current.employeeId,
        type: "NOTA_MENSAL",
        referenceMonth: current.referenceMonth,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    await tx.employeeDocument.create({
      data: {
        employeeId: current.employeeId,
        type: "NOTA_MENSAL",
        title: current.description,
        referenceMonth: current.referenceMonth,
        amountCents: current.amountCents,
        publicId: current.filePublicId || current.fileUrl.slice(-200),
        url: current.fileUrl,
        fileName: current.fileName,
        uploadedByUserId: input.actorId,
      },
    });

    const monthly = await tx.employeeMonthlyInvoice.upsert({
      where: {
        employeeId_referenceMonth: {
          employeeId: current.employeeId,
          referenceMonth: current.referenceMonth,
        },
      },
      create: {
        employeeId: current.employeeId,
        referenceMonth: current.referenceMonth,
        amountCents: current.amountCents,
        status: "ENTREGUE",
        issuedAt: new Date(),
        pdfUrl: current.fileUrl,
        pdfPublicId: current.filePublicId,
        createdByUserId: input.actorId,
        deletedAt: null,
      },
      update: {
        amountCents: current.amountCents ?? undefined,
        status: "ENTREGUE",
        issuedAt: new Date(),
        pdfUrl: current.fileUrl,
        pdfPublicId: current.filePublicId,
        deletedAt: null,
        createdByUserId: input.actorId,
      },
      select: { id: true },
    });

    return tx.employeeInvoiceSubmission.update({
      where: { id: current.id },
      data: {
        status: "APROVADA",
        reviewNotes: input.reviewNotes?.trim() || null,
        reviewedAt: new Date(),
        reviewedByUserId: input.actorId,
        financialEntryId,
        monthlyInvoiceId: monthly.id,
      },
      include: submissionInclude,
    });
  });

  if (current.employee.userId) {
    await createUserNotificationIfNew({
      userId: current.employee.userId,
      kind: "EMPLOYEE_INVOICE_REVIEWED",
      title: "Nota fiscal aprovada",
      body: `Sua nota de ${formatReferenceMonth(current.referenceMonth)} foi aprovada pela gerência.`,
      linkUrl: "/colaborador/notas",
      dedupeKey: `employee-invoice-reviewed:${current.id}`,
    });
  }

  return result;
}

export async function rejectInvoiceSubmission(input: {
  submissionId: string;
  actorId: string;
  reviewNotes?: string | null;
}): Promise<SubmissionRow> {
  const current = await getInvoiceSubmissionOrThrow(input.submissionId);
  if (current.status !== "PENDENTE") {
    throw new Error("ALREADY_REVIEWED");
  }

  const result = await prisma.employeeInvoiceSubmission.update({
    where: { id: current.id },
    data: {
      status: "RECUSADA",
      reviewNotes: input.reviewNotes?.trim() || null,
      reviewedAt: new Date(),
      reviewedByUserId: input.actorId,
    },
    include: submissionInclude,
  });

  if (current.employee.userId) {
    await createUserNotificationIfNew({
      userId: current.employee.userId,
      kind: "EMPLOYEE_INVOICE_REVIEWED",
      title: "Nota fiscal recusada",
      body:
        input.reviewNotes?.trim() ||
        `Sua nota de ${formatReferenceMonth(current.referenceMonth)} foi recusada. Envie novamente se precisar.`,
      linkUrl: "/colaborador/notas",
      dedupeKey: `employee-invoice-reviewed:${current.id}`,
    });
  }

  return result;
}
