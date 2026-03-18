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
  const link = "https://exemplo.com/login";
  return {
    nome: "Maria Silva",
    primeiro_nome: firstName("Maria Silva"),
    turma: "TER, QUI · 08:00–10:00 · Sala 1",
    curso: "Curso de Exemplo",
    cursos_matriculados: "Curso de Exemplo, Outro Curso",
    turmas_matriculadas:
      "Curso de Exemplo — TER, QUI · 08:00–10:00 · Sala 1\nOutro Curso — SEG, QUA · 19:00–21:00 · Sala 2",
    matriculas_html:
      "<ul><li>Curso de Exemplo · TER, QUI · 08:00–10:00 · Sala 1 · 10/03/2025 · 08:00 – 10:00 · Sala 1</li><li>Outro Curso · SEG, QUA · 19:00–21:00 · Sala 2 · 15/03/2025 · 19:00 – 21:00 · Sala 2</li></ul>",
    cursos_html:
      "<ul><li>Curso de Exemplo · TER, QUI · 08:00–10:00 · Sala 1 · 10/03/2025 · 08:00 – 10:00 · Sala 1</li><li>Outro Curso · SEG, QUA · 19:00–21:00 · Sala 2 · 15/03/2025 · 19:00 – 21:00 · Sala 2</li></ul>",
    cursos:
      "<ul><li>Curso de Exemplo · TER, QUI · 08:00–10:00 · Sala 1 · 10/03/2025 · 08:00 – 10:00 · Sala 1</li><li>Outro Curso · SEG, QUA · 19:00–21:00 · Sala 2 · 15/03/2025 · 19:00 – 21:00 · Sala 2</li></ul>",
    matriculas_texto:
      "- Curso de Exemplo · TER, QUI · 08:00–10:00 · Sala 1 · 10/03/2025 · 08:00 – 10:00 · Sala 1\n- Outro Curso · SEG, QUA · 19:00–21:00 · Sala 2 · 15/03/2025 · 19:00 – 21:00 · Sala 2",
    unidade: "N/A",
    link,
    data_inicio: "10/03/2025",
    horario: "08:00 – 10:00",
    local: "Sala 1",
    link_area_aluno: link,
    telefone_igh: "(91) 99999-0000",
    email_suporte: "suporte@exemplo.com.br",
  };
}
