import { prisma } from "@/lib/prisma";

export async function listSmsTemplates(activeOnly?: boolean) {
  const where = activeOnly ? { active: true } : {};
  return prisma.smsTemplate.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getSmsTemplate(id: string) {
  return prisma.smsTemplate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createSmsTemplate(data: {
  name: string;
  description?: string | null;
  categoryHint?: string | null;
  content: string;
  active?: boolean;
  createdById: string;
}) {
  return prisma.smsTemplate.create({
    data: {
      name: data.name,
      description: data.description ?? undefined,
      categoryHint: data.categoryHint ?? undefined,
      content: data.content,
      active: data.active ?? true,
      createdById: data.createdById,
    },
  });
}

export async function updateSmsTemplate(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    categoryHint?: string | null;
    content?: string;
    active?: boolean;
  }
) {
  return prisma.smsTemplate.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.categoryHint !== undefined && { categoryHint: data.categoryHint }),
      ...(data.content != null && { content: data.content }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}

export async function toggleSmsTemplateActive(id: string) {
  const t = await prisma.smsTemplate.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!t) return null;
  return prisma.smsTemplate.update({
    where: { id },
    data: { active: !t.active },
  });
}
