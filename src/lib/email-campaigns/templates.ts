import { prisma } from "@/lib/prisma";
import {
  renderSubject,
  renderHtmlContent,
  renderTextContent,
  firstName,
  type PlaceholderData,
} from "./placeholders";

export async function listEmailTemplates(activeOnly?: boolean) {
  const where = activeOnly ? { active: true } : {};
  return prisma.emailTemplate.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getEmailTemplate(id: string) {
  return prisma.emailTemplate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createEmailTemplate(data: {
  name: string;
  description?: string | null;
  categoryHint?: string | null;
  subjectTemplate: string;
  htmlContent?: string | null;
  textContent?: string | null;
  active?: boolean;
  createdById: string;
}) {
  return prisma.emailTemplate.create({
    data: {
      name: data.name,
      description: data.description ?? undefined,
      categoryHint: data.categoryHint ?? undefined,
      subjectTemplate: data.subjectTemplate,
      htmlContent: data.htmlContent ?? undefined,
      textContent: data.textContent ?? undefined,
      active: data.active ?? true,
      createdById: data.createdById,
    },
  });
}

export async function updateEmailTemplate(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    categoryHint?: string | null;
    subjectTemplate?: string;
    htmlContent?: string | null;
    textContent?: string | null;
    active?: boolean;
  }
) {
  return prisma.emailTemplate.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.categoryHint !== undefined && { categoryHint: data.categoryHint }),
      ...(data.subjectTemplate != null && { subjectTemplate: data.subjectTemplate }),
      ...(data.htmlContent !== undefined && { htmlContent: data.htmlContent }),
      ...(data.textContent !== undefined && { textContent: data.textContent }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}

export async function toggleEmailTemplateActive(id: string) {
  const t = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!t) return null;
  return prisma.emailTemplate.update({
    where: { id },
    data: { active: !t.active },
  });
}

/**
 * Renderiza um template com os placeholders fornecidos.
 * Retorna subject, htmlContent e textContent prontos para uso (ou para preview).
 */
export function renderEmailTemplate(
  subjectTemplate: string,
  htmlContent: string | null,
  textContent: string | null,
  data: PlaceholderData
): { subject: string; htmlContent: string | null; textContent: string | null } {
  return {
    subject: renderSubject(subjectTemplate, data),
    htmlContent:
      htmlContent != null && htmlContent.trim() !== ""
        ? renderHtmlContent(htmlContent, data)
        : null,
    textContent:
      textContent != null && textContent.trim() !== ""
        ? renderTextContent(textContent, data)
        : null,
  };
}

/**
 * Dados de placeholder genéricos para preview de template (ex.: nome, curso, turma exemplo).
 */
export function getSamplePlaceholderData(): PlaceholderData {
  return {
    nome: "Maria Silva",
    primeiro_nome: firstName("Maria Silva"),
    turma: "Turma A",
    curso: "Curso de Exemplo",
    unidade: "N/A",
    link: "",
  };
}
